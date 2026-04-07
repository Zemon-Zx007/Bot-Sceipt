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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ฟังก์ชันดึงรายชื่อบอท
async function getBotListData() {
    const guild = client.guilds.cache.first();
    if (!guild) return [];
    try {
        await guild.members.fetch();
        const bots = guild.members.cache.filter(member => member.user.bot);
        return bots.map(b => ({
            id: b.id,
            name: b.user.username,
            avatar: b.user.displayAvatarURL({ extension: 'png', size: 256 })
        }));
    } catch (e) { return []; }
}

// ส่งข้อมูลเมื่อมีคนเชื่อมต่อหน้าเว็บ
io.on('connection', async (socket) => {
    const bots = await getBotListData();
    socket.emit('update-bots', bots);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ],
    partials: [Partials.Channel]
});

// Real-time Event: เมื่อบอทเข้าหรือออกจากเซิร์ฟเวอร์
client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) io.emit('update-bots', await getBotListData());
});
client.on('guildMemberRemove', async (member) => {
    if (member.user.bot) io.emit('update-bots', await getBotListData());
});

server.listen(port, '0.0.0.0', () => {
    console.log(`🌐 SWIFT HUB Dashboard Online on port ${port}`);
});

// --- โค้ดส่วนจัดการสคริปต์ของเดิม (ไม่เปลี่ยนแปลง) ---
const TOKEN = process.env.TOKEN;
const OWNER_ID = process.env.OWNER_ID;
const MAIN_BANNER = "https://cdn.discordapp.com/attachments/1480814533214732308/1491139952409448498/IMG_2030.gif";
let scriptData = []; 
const userSelections = new Map();
let mainPanelMessage = null; 

async function autoTranslate(text) {
    try {
        const isThai = /[ก-ฮ]/.test(text);
        const targetLang = isThai ? 'en' : 'th';
        const res = await translate(text, { to: targetLang });
        return res.text;
    } catch (e) { return text; }
}

client.once('ready', async () => {
    console.log(`🌸 ปายพร้อมทำงานแล้วค่ะ! Logged in as ${client.user.tag}`);
    const commands = [{ name: 'zemon-setup', description: 'สร้างหน้า Panel แจกสคริปต์' }];
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); } catch (e) {}
});

client.on('interactionCreate', async interaction => {
    if (interaction.commandName === 'zemon-setup') {
        if (interaction.user.id !== OWNER_ID) return;
        mainPanelMessage = await sendMemberPanel(interaction, false);
    }
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_script') {
        userSelections.set(interaction.user.id, interaction.values[0]);
        await interaction.deferUpdate(); 
    }
    if (interaction.isButton() && interaction.customId === 'get_script_btn') {
        const selIdx = userSelections.get(interaction.user.id);
        if (selIdx === undefined || selIdx === 'none') return interaction.reply({ content: `❌ เลือกก่อนนะค้าบ!`, ephemeral: true });
        const script = scriptData[parseInt(selIdx)];
        const embed = new EmbedBuilder().setTitle(`✨ ${script.name}`).setDescription(`\`${script.code}\``).setColor('#ff0000');
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
});

async function sendMemberPanel(target, isUpdate) {
    const scriptList = scriptData.length > 0 ? scriptData.map((s, i) => `**${i + 1}.** ${s.name}`).join('\n') : '*ยังไม่มีสคริปต์*';
    const embed = new EmbedBuilder().setTitle('💎 SWIFT HUB').setDescription(scriptList).setColor('#ff0000').setImage(MAIN_BANNER);
    const selectMenu = new StringSelectMenuBuilder().setCustomId('select_script').setPlaceholder('📂 เลือกสคริปต์');
    scriptData.forEach((s, i) => selectMenu.addOptions({ label: s.name, value: i.toString() }));
    if (scriptData.length === 0) selectMenu.addOptions({ label: 'รอสคริปต์...', value: 'none' });
    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('get_script_btn').setLabel('📥 รับสคริปต์').setStyle(ButtonStyle.Danger));
    return isUpdate ? await target.edit({ embeds: [embed], components: [row1, row2] }) : await target.reply({ embeds: [embed], components: [row1, row2], fetchReply: true });
}

client.login(TOKEN);
