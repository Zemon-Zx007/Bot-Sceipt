const { 
    Client, GatewayIntentBits, Partials, ActionRowBuilder, 
    StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, 
    EmbedBuilder, REST, Routes, ModalBuilder, 
    TextInputBuilder, TextInputStyle 
} = require('discord.js');
const translate = require('@vitalets/google-translate-api'); // ตัวแปลภาษาตัวตึง

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

// ✨ ฟังก์ชันแปลภาษาอัจฉริยะโดยปาย
async function autoTranslate(text) {
    try {
        const isThai = /[ก-ฮ]/.test(text);
        const targetLang = isThai ? 'en' : 'th';
        const res = await translate(text, { to: targetLang });
        return res.text;
    } catch (e) {
        return text; // ถ้าแปลพลาด ให้ใช้ชื่อเดิมป้องกันบอทค้าง
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
        await interaction.deferReply({ ephemeral: true }); // รอแปลภาษาแป๊บนึงนะ
        const name = interaction.fields.getTextInputValue('in_name');
        const code = interaction.fields.getTextInputValue('in_code');
        const image = interaction.fields.getTextInputValue('in_img') || null;
        
        // แปลชื่อรอไว้เลย
        const translated = await autoTranslate(name);
        scriptData.push({ name, translated, code, image });

        await interaction.editReply({ content: `✅ เพิ่มสคริปต์ **${name}** เรียบร้อย! (แปล: ${translated})` });

        if (adminPanelMessage) await updateAdminPanel(adminPanelMessage, true);
        if (mainPanelMessage) await sendMemberPanel(mainPanelMessage, true);
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'select_script') {
        userSelections.set(interaction.user.id, interaction.values[0]);
        await interaction.deferUpdate(); 
    }

    if (interaction.isButton() && interaction.customId === 'get_script_btn') {
        const selIdx = userSelections.get(interaction.user.id);
        if (selIdx === undefined) return interaction.reply({ content: `❌ เลือกสคริปต์ก่อนนะค้าบซีม่อน!`, ephemeral: true });

        const script = scriptData[parseInt(selIdx)];
        let timeLeft = 60;

        const getEmbed = (time) => new EmbedBuilder()
            .setTitle(`✨ Script: ${script.name}`)
            .setDescription(`🇹🇭 คัดลอกโค้ด:\n🇺🇸 Copy code:\n\n\`${script.code}\`\n\n⏳ **ลบใน: \`${time}\` วินาที**`)
            .setColor('#2b2d31')
            .setImage(script.image || null);

        await interaction.reply({ embeds: [getEmbed(timeLeft)], ephemeral: true });

        const timer = setInterval(async () => {
            timeLeft -= 5;
            if (timeLeft <= 0) {
                clearInterval(timer);
                try { await interaction.deleteReply(); } catch(e){}
            } else {
                try { await interaction.editReply({ embeds: [getEmbed(timeLeft)] }); } catch(e){ clearInterval(timer); }
            }
        }, 5000);
    }
});

async function updateAdminPanel(target, isEdit) {
    const adminEmbed = new EmbedBuilder()
        .setTitle('⚙️ SWIFT HUB - ADMIN SYSTEM')
        .setDescription('ยินดีต้อนรับค่ะซีม่อน! กดปุ่มเพื่อเติมสคริปต์\nTotal Scripts: ' + scriptData.length)
        .setColor('#ff69b4');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('admin_add_btn').setLabel('➕ เติมสคริปต์ (Add)').setStyle(ButtonStyle.Primary)
    );

    if (isEdit) {
        const msg = target.edit ? target : target.message;
        return await msg.edit({ embeds: [adminEmbed], components: [row] }).catch(()=>{});
    } else {
        return await target.reply({ embeds: [adminEmbed], components: [row], fetchReply: true });
    }
}

async function sendMemberPanel(target, isUpdate) {
    const scriptList = scriptData.length > 0 
        ? scriptData.map((s, i) => `**${i + 1}.** ${s.name} / ${s.translated}`).join('\n')
        : '*ยังไม่มีสคริปต์ในระบบ / No scripts*';

    const embed = new EmbedBuilder()
        .setTitle('💎 SWIFT HUB - SCRIPT CENTER')
        .setDescription('━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
                        '📜 **รายชื่อสคริปต์ (Script List):**\n' + scriptList + '\n\n' +
                        '👋 **วิธีใช้งาน (How to use):**\n' +
                        '1️⃣ เลือกสคริปต์ (Select script)\n' +
                        '2️⃣ กดปุ่มรับโค้ด (Click Get Script)\n\n' +
                        '━━━━━━━━━━━━━━━━━━━━━━━━━━')
        .setColor('#00ff7f')
        .setImage(MAIN_BANNER)
        .setFooter({ text: 'Powered by Pai & Zemon' })
        .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_script')
        .setPlaceholder('📂 --- เลือกสคริปต์ที่นี่ / Select here ---')
        .addOptions(scriptData.length > 0 ? scriptData.map((s, index) => ({
            label: `${index + 1}. ${s.name}`,
            description: s.translated,
            value: index.toString(),
        })) : [{ label: 'รอเติมสคริปต์...', value: 'none' }]);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('get_script_btn').setLabel('📥 รับสคริปต์ (Get Script)').setStyle(ButtonStyle.Success)
    );

    if (isUpdate) {
        const msg = target.edit ? target : target.message;
        return await msg.edit({ embeds: [embed], components: [row1, row2] }).catch(()=>{});
    } else {
        return await target.reply({ embeds: [embed], components: [row1, row2], fetchReply: true });
    }
}

client.login(TOKEN);
