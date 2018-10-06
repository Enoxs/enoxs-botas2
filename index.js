const { Client, Util } = require('discord.js');
const client = new Client({ disableEveryone: true });




client.on("ready", async () => {
  console.log(`${client.user.username} prisijungė!`);
  client.user.setActivity(`Labas pasiklydėli!`);
});

client.on("message", async message => {

  if (message.author.bot) return;
  if (message.channel.type === "dm") return;

  let prefix = '-';
  let messageArray = message.content.split(" ");
  let cmd = messageArray[0];
  let args = messageArray.slice(1);

  if (cmd === `${prefix}testas`){
    message.channel.send("Veikia!");
  }
  if (cmd === `${prefix}komandos` || cmd === `${prefix}help`){
    message.channel.send(`
**Komandos:**
**⬥ -Komandos** ➔ Informacija apie visas komandas
**⬥ -Groti** ➔ Paleisti dainą iš youtube
**⬥ -Daina** ➔ Pažiūrėti kokia daina dabar groja
**⬥ -Pauze** ➔ Sustabdyti dabartinę dainą
**⬥ -Stabdys** ➔ Perjungti dainą į kitą
**⬥ -Paleisti** ➔ Paleisti dabartinę dainą
**⬥ -Praleisti** ➔ Praleisti dabartinę dainą
**⬥ -Sarasas** ➔ Pažiūrėti kokios dainos yra sąraše
		`);
  }	
	
	
});




const { TOKEN, PREFIX, GOOGLE_API_KEY } = require('./config');
const YouTube = require('simple-youtube-api');
const ytdl = require('ytdl-core');

const youtube = new YouTube(GOOGLE_API_KEY);

const queue = new Map();

client.on('warn', console.warn);

client.on('error', console.error);

client.on('ready', () => console.log('Pasiruošęs dirbti!'));

client.on('disconnect', () => console.log('Tuoj persikrausiu...'));

client.on('reconnecting', () => console.log('Persikraunu!'));

client.on('message', async msg => { // eslint-disable-line
	if (msg.author.bot) return undefined;
	if (!msg.content.startsWith(PREFIX)) return undefined;

	const args = msg.content.split(' ');
	const searchString = args.slice(1).join(' ');
	const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : '';
	const serverQueue = queue.get(msg.guild.id);

	let command = msg.content.toLowerCase().split(' ')[0];
	command = command.slice(PREFIX.length)

	if (command === 'groti' || command === 'play') {
		const voiceChannel = msg.member.voiceChannel;
		if (!voiceChannel) return msg.channel.send('Atsiprašau , bet gal pirma prisijunk prie muzikos kanalo?');
		const permissions = voiceChannel.permissionsFor(msg.client.user);
		
		
		
		if (!permissions.has('CONNECT')) return msg.channel.send('Neturiu leidimų, prašau duoti :(');
		if (!permissions.has('SPEAK')) return msg.channel.send('Neturiu leidimų, prašau duoti :(');
		
		if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
			const playlist = await youtube.getPlaylist(url);
			const videos = await playlist.getVideos();
			for (const video of Object.values(videos)) {
				const video2 = await youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop
				await handleVideo(video2, msg, voiceChannel, true); // eslint-disable-line no-await-in-loop
			}
			return msg.channel.send(`✅ Sąrašas: **${playlist.title}** buvo pridėta!`);
		} else {
			try {
				var video = await youtube.getVideo(url);
			} catch (error) {
				try {
					var videos = await youtube.searchVideos(searchString, 10);
					let index = 0;
					msg.channel.send(`
__**Muzika parinkta:**__
${videos.map(video2 => `**${++index} -** ${video2.title}`).join('\n')}
Pateikite vertę, kad pasirinktumėte vieną iš paieškos rezultatų nuo 1 iki 10.
					`);
					// eslint-disable-next-line max-depth
					try {
						var response = await msg.channel.awaitMessages(msg2 => msg2.content > 0 && msg2.content < 11, {
							maxMatches: 1,
							time: 10000,
							errors: ['time']
						});
					} catch (err) {
						console.error(err);
						return msg.channel.send('Neužpildyta arba neteisinga reikšmė, atšaukiamas vaizdo įrašų pasirinkimas.');
					}
					const videoIndex = parseInt(response.first().content);
					var video = await youtube.getVideoByID(videos[videoIndex - 1].id);
				} catch (err) {
					console.error(err);
					return msg.channel.send('🆘 Ot kurmis! Nieko neradau.');
				}
			}
			return handleVideo(video, msg, voiceChannel);
		}
	} else if (command === 'skip' || command === 'praleisti') {
		if (!msg.member.voiceChannel) return msg.channel.send('Kvailas? Prisijunk prie muzikos kanalo!');
		if (!serverQueue) return msg.channel.send('Šiuo metu nieko nėra , todėl galiu praleisti.');
		serverQueue.connection.dispatcher.end('Daina buvo praleista!');
		return undefined;
	} else if (command === 'stop' || command === 'stabdys') {
		if (!msg.member.voiceChannel) return msg.channel.send('Kvailas? Prisijunk prie muzikos kanalo!');
		if (!serverQueue) return msg.channel.send('Niekas šiuo metu negroja.');
		serverQueue.songs = [];
		serverQueue.connection.dispatcher.end('Stabdžiai buvo įjungti!');
		return undefined;
	} else if (command === 'volume' || command === 'garsumas') {
		if (!msg.member.voiceChannel) return msg.channel.send('Kvailas? Prisijunk prie muzikos kanalo!');
		if (!serverQueue) return msg.channel.send('Niekas šiuo metu negroja.');
		if (!args[1]) return msg.channel.send(`Dabar nustatytas garsumas: **${serverQueue.volume}**`);
		serverQueue.volume = args[1];
		serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5);
		return msg.channel.send(`Garsumas: **${args[1]}**`);
	} else if (command === 'np' || command === 'daina') {
		if (!serverQueue) return msg.channel.send('Šiuo metu niekas negroja.');
		return msg.channel.send(`🎶 Dabar groja: **${serverQueue.songs[0].title}**`);
	} else if (command === 'queue' || command === 'sarasas') {
		if (!serverQueue) return msg.channel.send('Šiuo metu niekas negroja.');
		return msg.channel.send(`
__**Sąrašas:**__
${serverQueue.songs.map(song => `**-** ${song.title}`).join('\n')}
**Dabar groja:** ${serverQueue.songs[0].title}
		`);
	} else if (command === 'pause' || command === 'pauze') {
		if (serverQueue && serverQueue.playing) {
			serverQueue.playing = false;
			serverQueue.connection.dispatcher.pause();
			return msg.channel.send('⏸ Daina buvo pristabdyta!');
		}
		return msg.channel.send('Šiuo metu niekas negroja.');
	} else if (command === 'resume' || command === 'paleisti') {
		if (serverQueue && !serverQueue.playing) {
			serverQueue.playing = true;
			serverQueue.connection.dispatcher.resume();
			return msg.channel.send('▶ Daina buvo paleista!');
		}
		return msg.channel.send('Niekas šiuo metu negroja.');
	}

	return undefined;
});

async function handleVideo(video, msg, voiceChannel, playlist = false) {
	const serverQueue = queue.get(msg.guild.id);
	console.log(video);
	const song = {
		id: video.id,
		title: Util.escapeMarkdown(video.title),
		url: `https://www.youtube.com/watch?v=${video.id}`
	};
	if (!serverQueue) {
		const queueConstruct = {
			textChannel: msg.channel,
			voiceChannel: voiceChannel,
			connection: null,
			songs: [],
			volume: 5,
			playing: true
		};
		queue.set(msg.guild.id, queueConstruct);

		queueConstruct.songs.push(song);

		try {
			var connection = await voiceChannel.join();
			queueConstruct.connection = connection;
			play(msg.guild, queueConstruct.songs[0]);
		} catch (error) {
			console.error(`Negaliu prisijungti prie: ${error}`);
			queue.delete(msg.guild.id);
			return msg.channel.send(`Negaliu prisijungti prie: ${error}`);
		}
	} else {
		serverQueue.songs.push(song);
		console.log(serverQueue.songs);
		if (playlist) return undefined;
		else return msg.channel.send(`✅ **${song.title}** buvo pridėta į sąrašą!`);
	}
	return undefined;
}











function play(guild, song) {
	const serverQueue = queue.get(guild.id);

	if (!song) {
		serverQueue.voiceChannel.leave();
		queue.delete(guild.id);
		return;
	}
	console.log(serverQueue.songs);

	const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
		.on('end', reason => {
			if (reason === 'Daina pasibaigė.') console.log('Daina pasibaigė.');
			else console.log(reason);
			serverQueue.songs.shift();
                setTimeout(function() {
                  play(guild, serverQueue.songs[0]);
                }, 500);
            })
		.on('error', error => console.error(error));
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

	serverQueue.textChannel.send(`🎶 Groja: **${song.title}**`);
}



client.login(process.env.token);
