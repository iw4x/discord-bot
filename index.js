const { Client, Events, GatewayIntentBits, ActivityType, EmbedBuilder } = require('discord.js');
const https = require('https');
const { token, logChannelId, allowedGuildId, protocol, excludedChannels, staffRoleId, rateLimit, rateLimitWindow } = require('./config.json');
const commands = require('./commands.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

const userCommandCounts = new Map();

function getPlayerCount() {
    return new Promise((resolve, reject) => {
        const url = `https://iw4x.dev/v1/servers/iw4x?protocol=${protocol}`;

        https.get(url, (res) => {
            let data = '';

            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    const totalPlayers = (jsonData.servers || [])
                        .reduce((sum, server) => sum + (server.clients || 0), 0);
                    resolve(totalPlayers);
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', reject);
    });
}

async function updateActivity() {
    try {
        const playerCount = await getPlayerCount();
        client.user.setPresence({
            status: 'idle',
            activities: [{
                name: `IW4x with ${playerCount} players`,
                type: ActivityType.Playing
            }]
        });
    } catch (error) {
        console.error('Error updating activity:', error);
        client.user.setPresence({
            status: 'idle',
            activities: [{
                name: 'IW4x Server',
                type: ActivityType.Playing
            }]
        });
    }
}

client.once(Events.ClientReady, () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    updateActivity();
    setInterval(updateActivity, 60000);
});

client.on(Events.MessageDelete, async message => {
    if (!message.guild ||
        message.guild.id !== allowedGuildId ||
        message.author?.bot ||
        !message.content) return;

    const logChannel = client.channels.cache.get(logChannelId);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle('Message Deleted')
        .setDescription(`Author: <@${message.author.id}> (\`${message.author.username}\`)`)
        .addFields(
            { name: 'Channel', value: `${message.channel}`, inline: true },
            { name: 'Content', value: `\`\`\`${message.content}\`\`\`` }
        )
        .setTimestamp()
        .setColor(0xff7770);

    await logChannel.send({ embeds: [embed] });
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    if (!newMessage.guild ||
        newMessage.guild.id !== allowedGuildId ||
        oldMessage.author?.bot ||
        !oldMessage.content ||
        !newMessage.content ||
        oldMessage.content === newMessage.content) return;

    const logChannel = client.channels.cache.get(logChannelId);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle('Message Edited')
        .setDescription(`Author: <@${oldMessage.author.id}> (\`${oldMessage.author.username}\`)`)
        .addFields(
            { name: 'Channel', value: `${oldMessage.channel}`, inline: true },
            { name: 'Before', value: `\`\`\`${oldMessage.content}\`\`\`` },
            { name: 'After', value: `\`\`\`${newMessage.content}\`\`\`` }
        )
        .setTimestamp()
        .setColor(0xdd70ff);

    await logChannel.send({ embeds: [embed] });
});

client.on(Events.MessageCreate, async message => {
    if (!message.guild ||
        message.guild.id !== allowedGuildId ||
        message.author.bot ||
        excludedChannels.includes(message.channel.id) ||
        !message.content.startsWith('!')) return;

    const userId = message.author.id;
    const now = Date.now();

    if (!userCommandCounts.has(userId)) {
        userCommandCounts.set(userId, { count: 0, lastCommandTimestamp: 0 });
    }

    const userRecord = userCommandCounts.get(userId);

    if (now - userRecord.lastCommandTimestamp >= rateLimitWindow) {
        userRecord.count = 0;
    }

    const isStaff = message.member?.roles.cache.has(staffRoleId);

    if (!isStaff && userRecord.count >= rateLimit) return;

    const commandData = commands.find(cmd => cmd.commands.includes(message.content));

    if (commandData) {
        userRecord.count++;
        userRecord.lastCommandTimestamp = now;

        const embed = new EmbedBuilder()
            .setTitle(commandData.title)
            .setDescription(commandData.description)
            .setColor(0x40aa50)
            .setTimestamp();

        await message.channel.send({ embeds: [embed] });
    }
});

client.login(token);