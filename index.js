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
let mainPanelMessage = null; 
let adminPanelMessage = null; 

// --- ระบบ Monitoring หน้าเว็บ ---
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
    } catch (e) { return []; }
}

io.on('connection', async (socket) => {
    const bots = await getBotListData();
    socket.emit('update-bots', bots);
});

client.on('guildMemberAdd', async (m) => { if(m.user.bot) io.emit('update-bots', await getBotListData()); });
client.on('guildMemberRemove', async (m) => { if(m.user.bot) io.emit('update-bots', await getBotListData()); });

// --- ฟังก์ชันช่วย (Utility) ---
async function autoTranslate(text) {
    try {
        const isThai = /[ก-ฮ]/.test(text);
        const targetLang = isThai ? 'en' : 'th';
        const res = await translate(text, { to: targetLang });
        return res.text;
    } catch (e) { return text; }
}

// --- ระบบ Panel ของซีม่อน ---

async function updateAdminPanel(target, isEdit) {
    const adminEmbed = new EmbedBuilder()
        .setTitle('⚙️ SWIFT HUB - ADMIN')
        .setDescription(`จัดการสคริปต์ได้ที่นี่เลยนะซีม่อน\n\n📊 **รายการปัจจุบัน:** ${scriptData.length} สคริปต์`)
        .setColor('#ff0000');
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('admin_add_btn').setLabel('➕ เพิ่มสคริปต์').setStyle(ButtonStyle.Danger)
    );
    return isEdit ? await target.edit({ embeds: [adminEmbed], components: [row] }) : await target.reply({ embeds: [adminEmbed], components: [row], fetchReply: true });
}

async function sendMemberPanel(target, isUpdate) {
    const scriptList = scriptData.length > 0 ? scriptData.map((s, i) => `**${i + 1}.** ${s.name} (${s.translated})`).join('\n') : '*ยังไม่มีสคริปต์*';
    const embed = new EmbedBuilder()
        .setTitle('💎 SWIFT HUB - SCRIPT CENTER')
        .setDescription('━━━━━━━━━━━━━━━━━━━━\n\n📜 **รายการสคริปต์:**\n' + scriptList + '\n\n━━━━━━━━━━━━━━━━━━━━')
        .setColor('#ff0000').setImage(MAIN_BANNER).setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_script').setPlaceholder('📂 --- เลือกสคริปต์ที่นี่ ---')
        .addOptions(scriptData.length > 0 ? scriptData.map((s, index) => ({ label: `${index + 1}. ${s.name}`, value: index.toString() })) : [{ label: 'รอสคริปต์...', value: 'none' }]);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('get_script_btn').setLabel('📥 รับสคริปต์ (Get Script)').setStyle(ButtonStyle.Danger));

    return isUpdate ? await target.edit({ embeds: [embed], components: [row1, row2] }) : await target.reply({ embeds: [embed], components: [row1, row2], fetchReply: true });
}

client.once('ready', async () => {
    console.log(`✅ [SYSTEM] ${client.user.tag} ONLINE`);
    const commands = [
        { name: 'zemon-setup', description: 'สร้างหน้า Panel แจกสคริปต์ (Member Panel)' },
        { name: 'zemon-admin', description: 'จัดการสคริปต์ (Admin Panel)' }
    ];
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); } catch (e) {}
});

client.on('interactionCreate', async interaction => {
    // 1. Setup Panels
    if (interaction.commandName === 'zemon-setup') {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'เฉพาะเจ้าของเท่านั้นนะค้าบ', ephemeral: true });
        mainPanelMessage = await sendMemberPanel(interaction, false);
    }
    if (interaction.commandName === 'zemon-admin') {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'เฉพาะเจ้าของเท่านั้นนะค้าบ', ephemeral: true });
        adminPanelMessage = await updateAdminPanel(interaction, false);
    }

    // 2. Admin Add Button (เด้ง Modal)
    if (interaction.isButton() && interaction.customId === 'admin_add_btn') {
        const modal = new ModalBuilder().setCustomId('modal_add_script').setTitle('📝 เพิ่มสคริปต์');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_name').setLabel("ชื่อสคริปต์").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_code').setLabel("โค้ดสคริปต์").setStyle(TextInputStyle.Paragraph).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_img').setLabel("ลิงก์รูปภาพสคริปต์").setStyle(TextInputStyle.Short).setRequired(false))
        );
        await interaction.showModal(modal);
    }

    // 3. Modal Submit (บันทึกและรีเฟรช Dropdown อัตโนมัติ)
    if (interaction.isModalSubmit() && interaction.customId === 'modal_add_script') {
        await interaction.deferReply({ ephemeral: true }); 
        const name = interaction.fields.getTextInputValue('in_name');
        const code = interaction.fields.getTextInputValue('in_code');
        const image = interaction.fields.getTextInputValue('in_img') || null;
        const translated = await autoTranslate(name);
        
        scriptData.push({ name, translated, code, image });
        
        await interaction.editReply({ content: `✅ เพิ่มสคริปต์ **${name}** เรียบร้อยแล้วนะซีม่อน!` });

        // รีเฟรชหน้า Panel ทันทีแบบ Real-time
        if (adminPanelMessage) await updateAdminPanel(adminPanelMessage, true);
        if (mainPanelMessage) await sendMemberPanel(mainPanelMessage, true);
    }

    // 4. Select Script
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_script') {
        if (interaction.values[0] === 'none') return;
        userSelections.set(interaction.user.id, interaction.values[0]);
        await interaction.deferUpdate(); 
    }

    // 5. Get Script Button (นับเวลาถอยหลัง และ จิ้มคัดลอก)
    if (interaction.isButton() && interaction.customId === 'get_script_btn') {
        const selIdx = userSelections.get(interaction.user.id);
        if (selIdx === undefined || selIdx === 'none') return interaction.reply({ content: `❌ ต้องเลือกสคริปต์ก่อนนะค้าบซีม่อน!`, ephemeral: true });
        
        const script = scriptData[parseInt(selIdx)];
        let timeLeft = 60;

        const getEmbed = (time) => new EmbedBuilder()
            .setTitle(`✨ ชื่อสคริปต์: ${script.name}`)
            .setDescription(`จิ้มที่โค้ดด้านล่างเพื่อคัดลอกได้เลยนะค้าบ:\n\n\`\`\`\n${script.code}\n\`\`\` \n\n⏳ (ข้อความนี้จะถูกลบใน ${time} วินาที)`)
            .setColor('#ff0000')
            .setImage(script.image || null)
            .setThumbnail(MAIN_BANNER);

        await interaction.reply({ embeds: [getEmbed(timeLeft)], ephemeral: true });

        // ระบบนับเวลาถอยหลังและลบข้อความ
        const timer = setInterval(async () => {
            timeLeft -= 10;
            if (timeLeft <= 0) {
                clearInterval(timer);
                try { await interaction.deleteReply(); userSelections.delete(interaction.user.id); } catch(e){}
            } else {
                try { await interaction.editReply({ embeds: [getEmbed(timeLeft)] }); } catch(e){ clearInterval(timer); }
            }
        }, 10000);
    }
});

server.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Monitoring on port ${port}`);
});

client.login(TOKEN);
