const { 
    Client, GatewayIntentBits, Partials, ActionRowBuilder, 
    StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, 
    EmbedBuilder, REST, Routes, ModalBuilder, 
    TextInputBuilder, TextInputStyle 
} = require('discord.js');
const translate = require('@iamtraction/google-translate'); 
const express = require('express');
const path = require('path');

if (typeof ReadableStream === 'undefined') {
    const { ReadableStream } = require('node:stream/web');
    global.ReadableStream = ReadableStream;
}

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API ใหม่: ดึงรายชื่อบอททั้งหมดในเซิร์ฟเวอร์ที่บอทตัวนี้อยู่
app.get('/api/bots', async (req, res) => {
    try {
        // ดึง Guild แรกที่บอทอยู่ (หรือระบุ ID เซิร์ฟเวอร์ได้)
        const guild = client.guilds.cache.first();
        if (!guild) return res.json([]);

        await guild.members.fetch(); // อัปเดตรายชื่อสมาชิก
        const bots = guild.members.cache.filter(member => member.user.bot);

        const botList = bots.map(b => ({
            name: b.user.username,
            avatar: b.user.displayAvatarURL({ format: 'png', size: 256 }),
            status: b.presence?.status || 'offline'
        }));

        res.json(botList);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch bots" });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🌐 Dashboard Online on port ${port}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers, // ต้องเปิดใน Discord Developer Portal ด้วยนะค้าบ
        GatewayIntentBits.GuildPresences
    ],
    partials: [Partials.Channel]
});

const TOKEN = process.env.TOKEN;
const OWNER_ID = process.env.OWNER_ID;
const MAIN_BANNER = "https://cdn.discordapp.com/attachments/1480814533214732308/1491139952409448498/IMG_2030.gif";

let scriptData = []; 
const userSelections = new Map();
let mainPanelMessage = null; 
let adminPanelMessage = null; 

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
    const commands = [
        { name: 'zemon-setup', description: 'สร้างหน้า Panel แจกสคริปต์ (Member Panel)' },
        { name: 'zemon-admin', description: 'จัดการสคริปต์ (Admin Panel)' }
    ];
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); } catch (e) { console.error(e); }
});

client.on('interactionCreate', async interaction => {
    if (interaction.commandName === 'zemon-setup') {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'เฉพาะเจ้าของเท่านั้นนะค้าบ', ephemeral: true });
        mainPanelMessage = await sendMemberPanel(interaction, false);
    }
    if (interaction.commandName === 'zemon-admin') {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'เฉพาะเจ้าของเท่านั้นนะค้าบ', ephemeral: true });
        adminPanelMessage = await updateAdminPanel(interaction, false);
    }
    if (interaction.isButton() && interaction.customId === 'admin_add_btn') {
        const modal = new ModalBuilder().setCustomId('modal_add_script').setTitle('📝 เพิ่มสคริปต์');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_name').setLabel("ชื่อสคริปต์").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_code').setLabel("โค้ดสคริปต์").setStyle(TextInputStyle.Paragraph).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_img').setLabel("ลิงก์รูปภาพสคริปต์").setStyle(TextInputStyle.Short).setRequired(false))
        );
        await interaction.showModal(modal);
    }
    if (interaction.isModalSubmit() && interaction.customId === 'modal_add_script') {
        await interaction.deferReply({ ephemeral: true }); 
        const name = interaction.fields.getTextInputValue('in_name');
        const code = interaction.fields.getTextInputValue('in_code');
        const image = interaction.fields.getTextInputValue('in_img') || null;
        const translated = await autoTranslate(name);
        scriptData.push({ name, translated, code, image });
        await interaction.editReply({ content: `✅ เพิ่มสคริปต์ **${name}** เรียบร้อย!` });
        if (adminPanelMessage) await updateAdminPanel(adminPanelMessage, true);
        if (mainPanelMessage) await sendMemberPanel(mainPanelMessage, true);
    }
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_script') {
        userSelections.set(interaction.user.id, interaction.values[0]);
        await interaction.deferUpdate(); 
    }
    if (interaction.isButton() && interaction.customId === 'get_script_btn') {
        const selIdx = userSelections.get(interaction.user.id);
        if (selIdx === undefined || selIdx === 'none') return interaction.reply({ content: `❌ ต้องเลือกสคริปต์ก่อนนะค้าบ!`, ephemeral: true });
        const script = scriptData[parseInt(selIdx)];
        let timeLeft = 60;
        const getEmbed = (time) => new EmbedBuilder()
            .setTitle(`✨ ชื่อสคริปต์: ${script.name}`)
            .setDescription(`จิ้มที่โค้ดด้านล่างเพื่อคัดลอกได้เลย:\n\n\`${script.code}\` \n\n⏳ (ลบใน ${time} วิ)`)
            .setColor('#ff0000').setImage(script.image || null).setThumbnail(MAIN_BANNER);
        await interaction.reply({ embeds: [getEmbed(timeLeft)], ephemeral: true });
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

async function updateAdminPanel(target, isEdit) {
    const adminEmbed = new EmbedBuilder()
        .setTitle('⚙️ SWIFT HUB - ADMIN')
        .setDescription(`จัดการสคริปต์ได้ที่นี่เลย\n\n📊 **รายการปัจจุบัน:** ${scriptData.length} สคริปต์`)
        .setColor('#ff0000');
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('admin_add_btn').setLabel('➕ เพิ่มสคริปต์').setStyle(ButtonStyle.Danger));
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

client.login(TOKEN);
