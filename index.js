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

// เก็บข้อมูลสคริปต์ และตัวแปรควบคุม Panel
let scriptData = []; 
const userSelections = new Map();
let mainPanelMessage = null; // สำหรับหน้าสมาชิก
let adminPanelMessage = null; // สำหรับหน้าแอดมิน (ป้องกันการเด้งซ้อน)

client.once('ready', async () => {
    console.log(`🌸 ปายพร้อมรับใช้ซีม่อนแล้วค่ะ! Logged in as ${client.user.tag}`);
    const commands = [
        { name: 'zemon-setup', description: 'สร้างหน้า Panel แจกสคริปต์ให้สมาชิก' },
        { name: 'zemon-admin', description: 'สร้างหน้า Panel สำหรับจัดการสคริปต์ (เฉพาะซีม่อน)' }
    ];
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); } catch (e) { console.error(e); }
});

client.on('interactionCreate', async interaction => {
    // --- 1. หน้า Panel สำหรับสมาชิก ---
    if (interaction.commandName === 'zemon-setup') {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'เฉพาะซีม่อนนะค้าบ', ephemeral: true });
        mainPanelMessage = await sendMemberPanel(interaction, false);
    }

    // --- 2. หน้า Admin สำหรับจัดการ ---
    if (interaction.commandName === 'zemon-admin') {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'เฉพาะซีม่อนนะค้าบ', ephemeral: true });
        adminPanelMessage = await updateAdminPanel(interaction, false);
    }

    // --- 3. ปุ่ม Admin Add ---
    if (interaction.isButton() && interaction.customId === 'admin_add_btn') {
        const modal = new ModalBuilder().setCustomId('modal_add_script').setTitle('📝 เพิ่มข้อมูลสคริปต์');
        const nInput = new TextInputBuilder().setCustomId('in_name').setLabel("ชื่อสคริปต์").setStyle(TextInputStyle.Short).setRequired(true);
        const cInput = new TextInputBuilder().setCustomId('in_code').setLabel("โค้ดสคริปต์").setStyle(TextInputStyle.Paragraph).setRequired(true);
        const iInput = new TextInputBuilder().setCustomId('in_img').setLabel("ลิงก์รูปภาพ (Discord Link)").setStyle(TextInputStyle.Short).setRequired(false);
        modal.addComponents(new ActionRowBuilder().addComponents(nInput), new ActionRowBuilder().addComponents(cInput), new ActionRowBuilder().addComponents(iInput));
        await interaction.showModal(modal);
    }

    // --- 4. บันทึกสคริปต์ (แก้ปัญหาเด้งซ้อน) ---
    if (interaction.isModalSubmit() && interaction.customId === 'modal_add_script') {
        const name = interaction.fields.getTextInputValue('in_name');
        const code = interaction.fields.getTextInputValue('in_code');
        const image = interaction.fields.getTextInputValue('in_img') || null;
        scriptData.push({ name, code, image });

        // ตอบกลับแค่ให้ Modal หายไป (ไม่ส่ง Embed ใหม่ซ้อน)
        await interaction.reply({ content: `✅ เพิ่มสคริปต์ **${name}** เรียบร้อย!`, ephemeral: true });

        // อัปเดตหน้า Admin เดิม (ถ้ามีอยู่)
        if (adminPanelMessage) {
            await updateAdminPanel(adminPanelMessage, true);
        }
        
        // อัปเดตหน้า Panel สมาชิกเดิม (ถ้ามีอยู่)
        if (mainPanelMessage) {
            await sendMemberPanel(mainPanelMessage, true);
        }
    }

    // --- 5. เลือก Dropdown ---
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_script') {
        userSelections.set(interaction.user.id, interaction.values[0]);
        await interaction.deferUpdate(); 
    }

    // --- 6. ปุ่มรับสคริปต์ + Countdown ---
    if (interaction.isButton() && interaction.customId === 'get_script_btn') {
        const selIdx = userSelections.get(interaction.user.id);
        if (selIdx === undefined) {
            return interaction.reply({ content: `❌ คุณ <@${interaction.user.id}> ต้องเลือกสคริปต์ก่อนนะค้าบ!`, ephemeral: true });
        }

        const script = scriptData[parseInt(selIdx)];
        let timeLeft = 60;

        const getEmbed = (time) => new EmbedBuilder()
            .setTitle(`✨ สคริปต์ของคุณ: ${script.name}`)
            .setDescription(`จิ้มที่โค้ดด้านล่างเพื่อคัดลอกได้เลย:\n\n\`${script.code}\`\n\n⏳ **ข้อความนี้จะลบอัตโนมัติใน: \`${time}\` วินาที**`)
            .setColor('#2b2d31')
            .setImage(script.image || null);

        await interaction.reply({ embeds: [getEmbed(timeLeft)], ephemeral: true });

        const timer = setInterval(async () => {
            timeLeft -= 5;
            if (timeLeft <= 0) {
                clearInterval(timer);
                try { await interaction.deleteReply(); } catch(e){}
                userSelections.delete(interaction.user.id);
                if (mainPanelMessage) await sendMemberPanel(mainPanelMessage, true);
            } else {
                try { await interaction.editReply({ embeds: [getEmbed(timeLeft)] }); } catch(e){ clearInterval(timer); }
            }
        }, 5000);
    }
});

// ฟังก์ชันสร้าง/อัปเดตหน้า Admin (แก้ให้ Edit ของเดิม)
async function updateAdminPanel(target, isEdit) {
    const adminEmbed = new EmbedBuilder()
        .setTitle('⚙️ SWIFT HUB - ADMIN SYSTEM')
        .setDescription('ยินดีต้อนรับค่ะซีม่อน! กดปุ่มเพื่อเติมสคริปต์ใหม่\nข้อมูลจะถูกอัปเดตไปหน้า Panel สมาชิกทันที')
        .setColor('#ff69b4')
        .addFields({ name: '📊 จำนวนสคริปต์ปัจจุบัน', value: `\`${scriptData.length}\` รายการ`, inline: true });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('admin_add_btn').setLabel('➕ เติมสคริปต์ใหม่').setStyle(ButtonStyle.Primary)
    );

    if (isEdit) {
        // อัปเดตจาก Message หรือ Interaction เดิม
        if (target.edit) return await target.edit({ embeds: [adminEmbed], components: [row] }).catch(()=>{});
        if (target.message) return await target.message.edit({ embeds: [adminEmbed], components: [row] }).catch(()=>{});
    } else {
        return await target.reply({ embeds: [adminEmbed], components: [row], fetchReply: true });
    }
}

// ฟังก์ชันสร้าง/อัปเดตหน้า Panel สมาชิก
async function sendMemberPanel(target, isUpdate) {
    const scriptList = scriptData.length > 0 
        ? scriptData.map((s, i) => `**${i + 1}.** ${s.name}`).join('\n')
        : '*ยังไม่มีสคริปต์ในระบบ*';

    const embed = new EmbedBuilder()
        .setTitle('💎 SWIFT HUB - SCRIPT CENTER')
        .setDescription('━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
                        '📜 **สคริปต์ที่มีในตอนนี้:**\n' + scriptList + '\n\n' +
                        '👋 **วิธีใช้งาน:**\n' +
                        '1️⃣ เลือกสคริปต์ในเมนูด้านล่าง\n' +
                        '2️⃣ กดปุ่มสีเขียวเพื่อรับโค้ด\n\n' +
                        '📌 *จิ้มที่โค้ดเพื่อคัดลอกทันที*\n' +
                        '━━━━━━━━━━━━━━━━━━━━━━━━━━')
        .setColor('#00ff7f')
        .setThumbnail('https://cdn.discordapp.com/emojis/1105151516052062258.webp') 
        .setFooter({ text: 'Powered by Pai & Zemon • อัปเดตล่าสุด' })
        .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_script')
        .setPlaceholder('📂 --- คลิกเพื่อเลือกสคริปต์ที่นี่ ---')
        .addOptions(scriptData.length > 0 ? scriptData.map((s, index) => ({
            label: `${index + 1}. ${s.name}`,
            value: index.toString(),
        })) : [{ label: 'รอเติมสคริปต์...', value: 'none' }]);

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
