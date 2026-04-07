// --- [1] การประกาศ Module ทั้งหมด ---
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

// แก้ปัญหา ReadableStream สำหรับ Node.js บาง Version บน Server
if (typeof ReadableStream === 'undefined') {
    const { ReadableStream } = require('node:stream/web');
    global.ReadableStream = ReadableStream;
}

// --- [2] ตั้งค่า Express และ Socket.io ---
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 3000;

// --- [3] ตั้งค่า Discord Client ---
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

// ข้อมูลตั้งค่าของซีม่อน
const TOKEN = process.env.TOKEN;
const OWNER_ID = process.env.OWNER_ID;
const MAIN_BANNER = "https://cdn.discordapp.com/attachments/1480814533214732308/1491139952409448498/IMG_2030.gif";

// ข้อมูลชั่วคราว (ถ้าปิดบอทข้อมูลจะรีเซ็ต)
let scriptData = []; 
const userSelections = new Map();

// --- [4] ส่วนของระบบ Monitoring (หน้าเว็บ) ---
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
        console.log("Error fetching bots:", e);
        return [];
    }
}

io.on('connection', async (socket) => {
    const bots = await getBotListData();
    socket.emit('update-bots', bots);
});

// อัปเดตเว็บเมื่อสถานะบอทเปลี่ยน
client.on('guildMemberAdd', async (m) => { if(m.user.bot) io.emit('update-bots', await getBotListData()); });
client.on('guildMemberRemove', async (m) => { if(m.user.bot) io.emit('update-bots', await getBotListData()); });

// --- [5] ระบบหลักของบอท (Panel & Script Center) ---

client.once('ready', async () => {
    console.log(`✅ [SYSTEM] บอท ${client.user.tag} ออนไลน์แล้ว!`);
    console.log(`🌐 [WEB] Monitoring รันที่พอร์ต ${port}`);

    const commands = [
        { name: 'zemon-setup', description: 'สร้างหน้า Panel สำหรับแจกสคริปต์' },
        { name: 'zemon-add', description: 'เพิ่มสคริปต์เข้าสู่ระบบ' }
    ];

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ [SLASH] ลงทะเบียนคำสั่งสำเร็จ');
    } catch (error) {
        console.error('❌ [ERROR] ลงทะเบียนคำสั่งไม่สำเร็จ:', error);
    }
});

client.on('interactionCreate', async interaction => {
    // 1. คำสั่งสร้างหน้า Panel
    if (interaction.commandName === 'zemon-setup') {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'เฉพาะซีม่อนเท่านั้นนะค้าบ', ephemeral: true });
        
        const embed = new EmbedBuilder()
            .setTitle('💎 SWIFT HUB - SCRIPT CENTER')
            .setDescription('--------------------------------------------\n\n📜 **สคริปต์ที่มีในตอนนี้ (Script List):**\n' + 
                (scriptData.length > 0 ? scriptData.map((s, i) => `${i + 1}. ${s.name}`).join('\n') : 'ยังไม่มีสคริปต์ในระบบ') +
                '\n\n👋 **วิธีใช้งาน (How to use):**\n1️⃣ เลือกสคริปต์ด้านล่าง (Select script below)\n2️⃣ กดปุ่มรับสคริปต์ (Click Get Script button)\n\n📌 **จิ้มที่โค้ดเพื่อคัดลอก (Click code to copy)**\n--------------------------------------------')
            .setColor('#ff0000')
            .setImage(MAIN_BANNER)
            .setFooter({ text: `Powered by Pai & Zemon • อัปเดตล่าสุดวันนี้ เวลา ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}` });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_script')
            .setPlaceholder('📁 --- เลือกสคริปต์ที่นี่ / Select script here ---')
            .addOptions(scriptData.length > 0 ? scriptData.map((s, i) => ({ label: s.name, value: i.toString() })) : [{ label: 'ไม่มีสคริปต์', value: 'none' }]);

        const button = new ButtonBuilder()
            .setCustomId('get_script_btn')
            .setLabel('📥 รับสคริปต์ (Get Script)')
            .setStyle(ButtonStyle.Success);

        const row1 = new ActionRowBuilder().addComponents(selectMenu);
        const row2 = new ActionRowBuilder().addComponents(button);

        await interaction.reply({ embeds: [embed], components: [row1, row2] });
    }

    // 2. คำสั่งเพิ่มสคริปต์
    if (interaction.commandName === 'zemon-add') {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'เฉพาะซีม่อนเท่านั้นนะค้าบ', ephemeral: true });
        
        const modal = new ModalBuilder().setCustomId('add_script_modal').setTitle('เพิ่มสคริปต์ใหม่');
        const nameInput = new TextInputBuilder().setCustomId('script_name').setLabel('ชื่อสคริปต์').setStyle(TextInputStyle.Short).setRequired(true);
        const contentInput = new TextInputBuilder().setCustomId('script_content').setLabel('โค้ดสคริปต์').setStyle(TextInputStyle.Paragraph).setRequired(true);
        
        modal.addComponents(new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(contentInput));
        await interaction.showModal(modal);
    }

    // 3. จัดการ Modal
    if (interaction.isModalSubmit() && interaction.customId === 'add_script_modal') {
        const name = interaction.fields.getTextInputValue('script_name');
        const content = interaction.fields.getTextInputValue('script_content');
        scriptData.push({ name, content });
        await interaction.reply({ content: `✅ เพิ่มสคริปต์ **${name}** สำเร็จแล้วนะซีม่อน!`, ephemeral: true });
    }

    // 4. จัดการการเลือกสคริปต์
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_script') {
        if (interaction.values[0] === 'none') return interaction.reply({ content: 'ยังไม่มีสคริปต์นะค้าบ', ephemeral: true });
        userSelections.set(interaction.user.id, interaction.values[0]);
        await interaction.reply({ content: `✅ เลือกสคริปต์ **${scriptData[interaction.values[0]].name}** แล้ว กดปุ่มเขียวเพื่อรับโค้ดได้เลย!`, ephemeral: true });
    }

    // 5. จัดการปุ่มกดรับสคริปต์
    if (interaction.isButton() && interaction.customId === 'get_script_btn') {
        const selectionIndex = userSelections.get(interaction.user.id);
        if (selectionIndex === undefined) return interaction.reply({ content: '❌ กรุณาเลือกสคริปต์จากเมนูก่อนนะค้าบ', ephemeral: true });
        
        const selected = scriptData[selectionIndex];
        const resultEmbed = new EmbedBuilder()
            .setTitle(`✨ ชื่อสคริปต์: ${selected.name}`)
            .setDescription(`จิ้มที่โค้ดด้านล่างเพื่อคัดลอกได้เลย:\n\n\`\`\`\n${selected.content}\n\`\`\``)
            .setColor('#ff0000')
            .setThumbnail(MAIN_BANNER)
            .setFooter({ text: '⌛ ข้อความนี้จะลบอัตโนมัติใน 50 วินาที' });

        const msg = await interaction.reply({ embeds: [resultEmbed], ephemeral: true, fetchReply: true });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 50000);
    }
});

// --- [6] รันเซิร์ฟเวอร์ ---
server.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Server is running on port ${port}`);
});

client.login(TOKEN);
