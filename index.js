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

// แก้ไข Error: Cannot find module 'socket.io'
// ** ซีม่อนอย่าลืมเพิ่ม socket.io ใน package.json นะค้าบ **
const { Server } = require('socket.io');

// แก้ไข Error: ReadableStream is not defined สำหรับ Node.js รุ่นเก่าบน Server
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

// เมื่อหน้าเว็บเชื่อมต่อ ให้ส่งข้อมูลบอททันที
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

// อัปเดตแบบ Real-time เมื่อบอทเข้าหรือออก
client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) io.emit('update-bots', await getBotListData());
});
client.on('guildMemberRemove', async (member) => {
    if (member.user.bot) io.emit('update-bots', await getBotListData());
});

// ใช้ server.listen แทน app.listen เพื่อให้ Socket.io ทำงานได้
server.listen(port, '0.0.0.0', () => {
    console.log(`🌐 SWIFT HUB Monitoring Online on port ${port}`);
});

// --- ส่วนจัดการระบบแจกสคริปต์ (โค้ดเดิมของซีม่อนที่ใช้งานได้) ---
const TOKEN = process.env.TOKEN;
const OWNER_ID = process.env.OWNER_ID;
const MAIN_BANNER = "https://cdn.discordapp.com/attachments/1480814533214732308/1491139952409448498/IMG_2030.gif";
let scriptData = []; 
const userSelections = new Map();

client.once('ready', async () => {
    console.log(`🌸 ปายพร้อมทำงานแล้วค่ะ! Logged in as ${client.user.tag}`);
    const commands = [{ name: 'zemon-setup', description: 'สร้างหน้า Panel แจกสคริปต์' }];
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); } catch (e) {}
});

client.on('interactionCreate', async interaction => {
    if (interaction.commandName === 'zemon-setup') {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'เฉพาะซีม่อนเท่านั้นนะค้าบ', ephemeral: true });
        await sendMemberPanel(interaction);
    }
    // ... (โค้ดส่วนอื่นๆ คงเดิม) ...
});

async function sendMemberPanel(target) {
    const embed = new EmbedBuilder().setTitle('💎 SWIFT HUB').setColor('#ff0000').setImage(MAIN_BANNER);
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('get_script_btn').setLabel('📥 รับสคริปต์').setStyle(ButtonStyle.Danger)
    );
    await target.reply({ embeds: [embed], components: [row] });
}

client.login(TOKEN);
