const { 
    Client, GatewayIntentBits, Partials, ActionRowBuilder, 
    StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, 
    EmbedBuilder, REST, Routes, ModalBuilder, 
    TextInputBuilder, TextInputStyle 
} = require('discord.js');
const translate = require('@iamtraction/google-translate'); 
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

if (typeof ReadableStream === 'undefined') {
    const { ReadableStream } = require('node:stream/web');
    global.ReadableStream = ReadableStream;
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 3000;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

const TOKEN = process.env.TOKEN;
const OWNER_ID = process.env.OWNER_ID;
const MAIN_BANNER = "https://cdn.discordapp.com/attachments/1480814533214732308/1491139952409448498/IMG_2030.gif";

let scriptData = []; 
const userSelections = new Map();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

async function getBotListData() {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return [];
        await guild.members.fetch();
        const bots = guild.members.cache.filter(member => member.user.bot);
        return bots.map(b => ({
            id: b.id,
            name: b.user.username,
            avatar: b.user.displayAvatarURL({ extension: 'png', size: 256 })
        }));
    } catch (e) {
        return [];
    }
}

io.on('connection', async (socket) => {
    const bots = await getBotListData();
    socket.emit('update-bots', bots);
});

client.on('guildMemberAdd', async (m) => { if(m.user.bot) io.emit('update-bots', await getBotListData()); });
client.on('guildMemberRemove', async (m) => { if(m.user.bot) io.emit('update-bots', await getBotListData()); });

client.once('ready', async () => {
    console.log(`✅ [SYSTEM] ${client.user.tag} ONLINE`);
    const commands = [
        { name: 'zemon-setup', description: 'สร้างหน้า Panel สำหรับแจกสคริปต์' },
        { name: 'zemon-add', description: 'เพิ่มสคริปต์เข้าสู่ระบบ' }
    ];
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    } catch (e) {}
});

client.on('interactionCreate', async interaction => {
    if (interaction.commandName === 'zemon-setup') {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'เฉพาะซีม่อนเท่านั้นนะค้าบ', ephemeral: true });
        
        const embed = new EmbedBuilder()
            .setTitle('💎 SWIFT HUB - SCRIPT CENTER')
            .setDescription('📜 **สคริปต์ที่มีในตอนนี้:**\n' + 
                (scriptData.length > 0 ? scriptData.map((s, i) => `${i + 1}. ${s.name}`).join('\n') : 'ยังไม่มีสคริปต์') +
                '\n\n1️⃣ เลือกสคริปต์\n2️⃣ กดรับสคริปต์')
            .setColor('#ff0000')
            .setImage(MAIN_BANNER);

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_script')
            .setPlaceholder('📁 เลือกสคริปต์ที่นี่')
            .addOptions(scriptData.length > 0 ? scriptData.map((s, i) => ({ label: s.name, value: i.toString() })) : [{ label: 'ไม่มีสคริปต์', value: 'none' }]);

        const button = new ButtonBuilder().setCustomId('get_script_btn').setLabel('📥 รับสคริปต์').setStyle(ButtonStyle.Success);
        const row1 = new ActionRowBuilder().addComponents(selectMenu);
        const row2 = new ActionRowBuilder().addComponents(button);

        await interaction.reply({ embeds: [embed], components: [row1, row2] });
    }

    if (interaction.commandName === 'zemon-add') {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'เฉพาะซีม่อนเท่านั้นนะค้าบ', ephemeral: true });
        const modal = new ModalBuilder().setCustomId('add_script_modal').setTitle('เพิ่มสคริปต์ใหม่');
        const nameInput = new TextInputBuilder().setCustomId('script_name').setLabel('ชื่อสคริปต์').setStyle(TextInputStyle.Short).setRequired(true);
        const contentInput = new TextInputBuilder().setCustomId('script_content').setLabel('โค้ดสคริปต์').setStyle(TextInputStyle.Paragraph).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(contentInput));
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'add_script_modal') {
        const name = interaction.fields.getTextInputValue('script_name');
        const content = interaction.fields.getTextInputValue('script_content');
        scriptData.push({ name, content });
        await interaction.reply({ content: `✅ เพิ่มสคริปต์ **${name}** สำเร็จ!`, ephemeral: true });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'select_script') {
        if (interaction.values[0] === 'none') return interaction.reply({ content: 'ไม่มีสคริปต์นะค้าบ', ephemeral: true });
        userSelections.set(interaction.user.id, interaction.values[0]);
        await interaction.reply({ content: `✅ เลือก **${scriptData[interaction.values[0]].name}** แล้ว กดปุ่มเขียวรับโค้ดเลย!`, ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId === 'get_script_btn') {
        const idx = userSelections.get(interaction.user.id);
        if (idx === undefined) return interaction.reply({ content: '❌ เลือกสคริปต์ก่อนนะค้าบ', ephemeral: true });
        const selected = scriptData[idx];
        const resultEmbed = new EmbedBuilder()
            .setTitle(`✨ สคริปต์: ${selected.name}`)
            .setDescription(`\`\`\`\n${selected.content}\n\`\`\``)
            .setColor('#ff0000');
        await interaction.reply({ embeds: [resultEmbed], ephemeral: true });
    }
});

server.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Monitoring on port ${port}`);
});

client.login(TOKEN);
