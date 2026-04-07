const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    REST, 
    Routes,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    partials: [Partials.Channel]
});

const TOKEN = process.env.TOKEN;
const OWNER_ID = process.env.OWNER_ID;
const MAIN_BANNER = "https://cdn.discordapp.com/attachments/1480814533214732308/1491139952409448498/IMG_2030.gif?ex=69d69bcc&is=69d54a4c&hm=410822760ed527fdf607e3871ef91cd7b57acdd3f1a3cadf6104be62e645d3fe&";

// เก็บข้อมูลสคริปต์
let scriptData = []; 
const userSelections = new Map();
let mainPanelMessage = null; 
let adminPanelMessage = null; 

// ฟังก์ชันช่วยแปลชื่อสคริปต์แบบง่าย (Thai <-> English)
function translateName(name) {
    const isThai = /[ก-ฮ]/.test(name);
    if (isThai) {
        // ถ้าเป็นไทย ลองหาคำทับศัพท์พื้นฐาน หรือเติม (TH/EN)
        return `${name} (English Version)`;
    } else {
        return `${name} (เวอร์ชันไทย)`;
    }
}

client.once('ready', async () => {
    console.log(`🌸 ปายพร้อมรับใช้ซีม่อนแล้วค่ะ! Logged in as ${client.user.tag}`);
    const commands = [
        { name: 'zemon-setup', description: 'สร้างหน้า Panel แจกสคริปต์ให้สมาชิก (Setup Member Panel)' },
        { name: 'zemon-admin', description: 'สร้างหน้า Panel สำหรับจัดการสคริปต์ (Admin Panel)' }
    ];
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); } catch (e) { console.error(e); }
});

client.on('interactionCreate', async interaction => {
    // --- 1. หน้า Panel สำหรับสมาชิก ---
    if (interaction.commandName === 'zemon-setup') {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'เฉพาะซีม่อนนะค้าบ (Owner only)', ephemeral: true });
        mainPanelMessage = await sendMemberPanel(interaction, false);
    }

    // --- 2. หน้า Admin สำหรับจัดการ ---
    if (interaction.commandName === 'zemon-admin') {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'เฉพาะซีม่อนนะค้าบ (Owner only)', ephemeral: true });
        adminPanelMessage = await updateAdminPanel(interaction, false);
    }

    // --- 3. ปุ่ม Admin Add ---
    if (interaction.isButton() && interaction.customId === 'admin_add_btn') {
        const modal = new ModalBuilder().setCustomId('modal_add_script').setTitle('📝 เพิ่มสคริปต์ (Add Script)');
        const nInput = new TextInputBuilder().setCustomId('in_name').setLabel("ชื่อสคริปต์ (Script Name)").setStyle(TextInputStyle.Short).setRequired(true);
        const cInput = new TextInputBuilder().setCustomId('in_code').setLabel("โค้ดสคริปต์ (Script Code)").setStyle(TextInputStyle.Paragraph).setRequired(true);
        const iInput = new TextInputBuilder().setCustomId('in_img').setLabel("ลิงก์รูปภาพสคริปต์ (Script Image Link)").setStyle(TextInputStyle.Short).setRequired(false);
        modal.addComponents(new ActionRowBuilder().addComponents(nInput), new ActionRowBuilder().addComponents(cInput), new ActionRowBuilder().addComponents(iInput));
        await interaction.showModal(modal);
    }

    // --- 4. บันทึกสคริปต์ ---
    if (interaction.isModalSubmit() && interaction.customId === 'modal_add_script') {
        const name = interaction.fields.getTextInputValue('in_name');
        const code = interaction.fields.getTextInputValue('in_code');
        const image = interaction.fields.getTextInputValue('in_img') || null;
        scriptData.push({ name, code, image });

        await interaction.reply({ content: `✅ เพิ่มสคริปต์ **${name}** เรียบร้อย! (Success)`, ephemeral: true });

        if (adminPanelMessage) await updateAdminPanel(adminPanelMessage, true);
        if (mainPanelMessage) await sendMemberPanel(mainPanelMessage, true);
    }

    // --- 5. เลือก Dropdown ---
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_script') {
        userSelections.set(interaction.user.id, interaction.values[0]);
        await interaction.deferUpdate(); 
    }

    // --- 6. ปุ่มรับสคริปต์ ---
    if (interaction.isButton() && interaction.customId === 'get_script_btn') {
        const selIdx = userSelections.get(interaction.user.id);
        if (selIdx === undefined) {
            return interaction.reply({ content: `❌ คุณ <@${interaction.user.id}> ต้องเลือกสคริปต์ก่อนนะค้าบ!\n❌ Please select a script first!`, ephemeral: true });
        }

        const script = scriptData[parseInt(selIdx)];
        let timeLeft = 60;

        const getEmbed = (time) => new EmbedBuilder()
            .setTitle(`✨ Script: ${script.name}`)
            .setDescription(`🇹🇭 จิ้มที่โค้ดด้านล่างเพื่อคัดลอก:\n🇺🇸 Click the code below to copy:\n\n\`${script.code}\`\n\n⏳ **Auto delete in: \`${time}\`s**`)
            .setColor('#2b2d31')
            .setImage(script.image || null);

        await interaction.reply({ embeds: [getEmbed(timeLeft)], ephemeral: true });

        const timer = setInterval(async () => {
            timeLeft -= 5;
            if (timeLeft <= 0) {
                clearInterval(timer);
                try { await interaction.deleteReply(); } catch(e){}
                userSelections.delete(interaction.user.id);
            } else {
                try { await interaction.editReply({ embeds: [getEmbed(timeLeft)] }); } catch(e){ clearInterval(timer); }
            }
        }, 5000);
    }
});

async function updateAdminPanel(target, isEdit) {
    const adminEmbed = new EmbedBuilder()
        .setTitle('⚙️ SWIFT HUB - ADMIN SYSTEM')
        .setDescription('ยินดีต้อนรับค่ะซีม่อน! กดปุ่มเพื่อเติมสคริปต์ใหม่\nWelcome Zemon! Click button to add new script.')
        .setColor('#ff69b4')
        .addFields({ name: '📊 จำนวนสคริปต์ (Total)', value: `\`${scriptData.length}\` รายการ (Items)`, inline: true });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('admin_add_btn').setLabel('➕ เติมสคริปต์ (Add Script)').setStyle(ButtonStyle.Primary)
    );

    if (isEdit) {
        if (target.edit) return await target.edit({ embeds: [adminEmbed], components: [row] }).catch(()=>{});
        if (target.message) return await target.message.edit({ embeds: [adminEmbed], components: [row] }).catch(()=>{});
    } else {
        return await target.reply({ embeds: [adminEmbed], components: [row], fetchReply: true });
    }
}

async function sendMemberPanel(target, isUpdate) {
    const scriptList = scriptData.length > 0 
        ? scriptData.map((s, i) => `**${i + 1}.** ${s.name} / ${translateName(s.name)}`).join('\n')
        : '*ยังไม่มีสคริปต์ในระบบ / No scripts available*';

    const embed = new EmbedBuilder()
        .setTitle('💎 SWIFT HUB - SCRIPT CENTER')
        .setDescription('━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
                        '📜 **สคริปต์ที่มีในตอนนี้ (Script List):**\n' + scriptList + '\n\n' +
                        '👋 **วิธีใช้งาน (How to use):**\n' +
                        '1️⃣ เลือกสคริปต์ด้านล่าง (Select script below)\n' +
                        '2️⃣ กดปุ่มรับสคริปต์ (Click Get Script button)\n\n' +
                        '📌 *จิ้มที่โค้ดเพื่อคัดลอก (Click code to copy)*\n' +
                        '━━━━━━━━━━━━━━━━━━━━━━━━━━')
        .setColor('#00ff7f')
        .setImage(MAIN_BANNER) // ใส่รูปใหญ่ตามที่ซีม่อนขอ
        .setFooter({ text: 'Powered by Pai & Zemon • อัปเดตล่าสุด (Last Update)' })
        .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_script')
        .setPlaceholder('📂 --- เลือกสคริปต์ที่นี่ / Select script here ---')
        .addOptions(scriptData.length > 0 ? scriptData.map((s, index) => ({
            label: `${index + 1}. ${s.name}`,
            description: translateName(s.name),
            value: index.toString(),
        })) : [{ label: 'รอเติมสคริปต์... (Waiting...)', value: 'none' }]);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('get_script_btn').setLabel('📥 รับสคริปต์ (Get Script)').setStyle(ButtonStyle.Success)
    );

    if (isUpdate) {
        if (target.edit) return await target.edit({ embeds: [embed], components: [row1, row2] }).catch(()=>{});
        if (target.message) return await target.message.edit({ embeds: [embed], components: [row1, row2] }).catch(()=>{});
    } else {
        return await target.reply({ embeds: [embed], components: [row1, row2], fetchReply: true });
    }
}

client.login(TOKEN);
