const { 
    Client, GatewayIntentBits, Partials, ActionRowBuilder, 
    StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, 
    EmbedBuilder, REST, Routes, ModalBuilder, 
    TextInputBuilder, TextInputStyle 
} = require('discord.js');

const translate = require('@iamtraction/google-translate'); 

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    partials: [Partials.Channel]
});

const TOKEN = process.env.TOKEN;
const OWNER_ID = process.env.OWNER_ID;
const MAIN_BANNER = "https://cdn.discordapp.com/attachments/1480814533214732308/1491139952409448498/IMG_2030.gif?ex=69d69bcc&is=69d54a4c&hm=410822760ed527fdf607e3871ef91cd7b57acdd3f1a3cadf6104be62e645d3fe&";

let scriptData = []; 
const userSelections = new Map();
let mainPanelMessage = null; 
let adminPanelMessage = null; 

// ✨ ฟังก์ชันแปลภาษาฉบับปรับปรุงใหม่โดยปาย
async function autoTranslate(text) {
    try {
        const isThai = /[ก-ฮ]/.test(text);
        const targetLang = isThai ? 'en' : 'th';
        const res = await translate(text, { to: targetLang });
        return res.text;
    } catch (e) {
        console.log("Translation Error:", e);
        return text; 
    }
}

client.once('ready', async () => {
    console.log(`🌸 ปายพร้อมรับใช้ซีม่อนแล้วค่ะ! Logged in as ${client.user.tag}`);
    const commands = [
        { name: 'zemon-setup', description: 'สร้างหน้า Panel แจกสคริปต์ (Member Panel)' },
        { name: 'zemon-admin', description: 'จัดการสคริปต์ (Admin Panel)' }
    ];
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); } catch (e) { console.error(e); }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() && !interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;

    if (interaction.commandName === 'zemon-setup') {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'เฉพาะซีม่อนนะค้าบ', ephemeral: true });
        mainPanelMessage = await sendMemberPanel(interaction, false);
    }

    if (interaction.commandName === 'zemon-admin') {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'เฉพาะซีม่อนนะค้าบ', ephemeral: true });
        adminPanelMessage = await updateAdminPanel(interaction, false);
    }

    if (interaction.isButton() && interaction.customId === 'admin_add_btn') {
        const modal = new ModalBuilder().setCustomId('modal_add_script').setTitle('📝 เพิ่มสคริปต์');
        const nInput = new TextInputBuilder().setCustomId('in_name').setLabel("ชื่อสคริปต์").setStyle(TextInputStyle.Short).setRequired(true);
        const cInput = new TextInputBuilder().setCustomId('in_code').setLabel("โค้ดสคริปต์").setStyle(TextInputStyle.Paragraph).setRequired(true);
        const iInput = new TextInputBuilder().setCustomId('in_img').setLabel("ลิงก์รูปภาพสคริปต์").setStyle(TextInputStyle.Short).setRequired(false);
        modal.addComponents(new ActionRowBuilder().addComponents(nInput), new ActionRowBuilder().addComponents(cInput), new ActionRowBuilder().addComponents(iInput));
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'modal_add_script') {
        await interaction.deferReply({ ephemeral: true }); 
        const name = interaction.fields.getTextInputValue('in_name');
        const code = interaction.fields.getTextInputValue('in_code');
        const image = interaction.fields.getTextInputValue('in_img') || null;
        
        const translated = await autoTranslate(name);
        scriptData.push({ name, translated, code, image });

        await interaction.editReply({ content: `✅ เพิ่มสคริปต์ **${name}** เรียบร้อย! (แปล: ${translated})` });

        // อัปเดตหน้าจอทันที
        if (adminPanelMessage) await updateAdminPanel(adminPanelMessage, true);
        if (mainPanelMessage) await sendMemberPanel(mainPanelMessage, true);
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'select_script') {
        userSelections.set(interaction.user.id, interaction.values[0]);
        await interaction.deferUpdate(); 
    }

    if (interaction.isButton() && interaction.customId === 'get_script_btn') {
        const selIdx = userSelections.get(interaction.user.id);
        if (selIdx === undefined || selIdx === 'none') {
             return interaction.reply({ content: `❌ ซีม่อนต้องเลือกสคริปต์ก่อนนะค้าบ!`, ephemeral: true });
        }

        const script = scriptData[parseInt(selIdx)];
        let timeLeft = 60;

        const getEmbed = (time) => new EmbedBuilder()
            .setTitle(`✨ ชื่อสคริปต์: ${script.name}`)
            .setDescription(`จิ้มที่โค้ดด้านล่างเพื่อคัดลอกได้เลย:\n\`\`\`lua\n${script.code}\n\`\`\`\n⏳ (ข้อความนี้จะลบอัตโนมัติใน ${time} วินาที)`)
            .setColor('#2b2d31')
            .setImage(script.image || null)
            .setThumbnail(MAIN_BANNER);

        await interaction.reply({ embeds: [getEmbed(timeLeft)], ephemeral: true });

        const timer = setInterval(async () => {
            timeLeft -= 10;
            if (timeLeft <= 0) {
                clearInterval(timer);
                try { await interaction.deleteReply(); } catch(e){}
            } else {
                try { await interaction.editReply({ embeds: [getEmbed(timeLeft)] }); } catch(e){ clearInterval(timer); }
            }
        }, 10000);
    }
});

async function updateAdminPanel(target, isEdit) {
    const adminEmbed = new EmbedBuilder()
        .setTitle('⚙️ SWIFT HUB - ADMIN SYSTEM')
        .setDescription(`ยินดีต้อนรับค่ะซีม่อน! กดปุ่มเพื่อเติมสคริปต์ใหม่\nข้อมูลจะถูกอัปเดตไปหน้า Panel สมาชิกทันที\n\n📊 **จำนวนสคริปต์ปัจจุบัน**\n${scriptData.length} รายการ`)
        .setColor('#ff69b4');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('admin_add_btn').setLabel('➕ เติมสคริปต์ใหม่').setStyle(ButtonStyle.Primary)
    );

    try {
        if (isEdit) {
            return await target.edit({ embeds: [adminEmbed], components: [row] });
        } else {
            return await target.reply({ embeds: [adminEmbed], components: [row], fetchReply: true });
        }
    } catch (e) { console.log("Admin Panel Update Error"); }
}

async function sendMemberPanel(target, isUpdate) {
    const scriptList = scriptData.length > 0 
        ? scriptData.map((s, i) => `**${i + 1}.** ${s.name} / ${s.translated}`).join('\n')
        : '*ยังไม่มีสคริปต์ในตอนนี้ / No scripts available*';

    const embed = new EmbedBuilder()
        .setTitle('💎 SWIFT HUB - SCRIPT CENTER')
        .setDescription('━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
                        '📜 **สคริปต์ที่มีในตอนนี้ (Script List):**\n' + scriptList + '\n\n' +
                        '👋 **วิธีใช้งาน (How to use):**\n' +
                        '1️⃣ เลือกสคริปต์ด้านล่าง (Select script below)\n' +
                        '2️⃣ กดปุ่มรับสคริปต์ (Click Get Script button)\n\n' +
                        '📌 หมายเหตุ: จิ้มที่ตัวโค้ดเพื่อคัดลอกทันที\n' +
                        '━━━━━━━━━━━━━━━━━━━━━━━━━━')
        .setColor('#00ff7f')
        .setImage(MAIN_BANNER)
        .setFooter({ text: `Powered by Pai & Zemon • อัปเดตล่าสุด` })
        .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_script')
        .setPlaceholder('📂 --- คลิกเพื่อเลือกสคริปต์ที่นี่ / Select script here ---')
        .addOptions(scriptData.length > 0 ? scriptData.map((s, index) => ({
            label: `${index + 1}. ${s.name}`,
            description: `แปล: ${s.translated}`,
            value: index.toString(),
        })) : [{ label: 'รอเติมสคริปต์...', value: 'none' }]);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('get_script_btn').setLabel('📥 รับสคริปต์ (Get Script)').setStyle(ButtonStyle.Success)
    );

    try {
        if (isUpdate) {
            return await target.edit({ embeds: [embed], components: [row1, row2] });
        } else {
            return await target.reply({ embeds: [embed], components: [row1, row2], fetchReply: true });
        }
    } catch (e) { console.log("Member Panel Update Error"); }
}

client.login(TOKEN);
