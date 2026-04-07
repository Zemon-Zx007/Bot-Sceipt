const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    SlashCommandBuilder, 
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

// เก็บข้อมูลสคริปต์: { name, code, image }
let scriptData = []; 
const userSelections = new Map();

client.once('ready', async () => {
    console.log(`🌸 ปายพร้อมรับใช้ซีม่อนแล้วค่ะ! Logged in as ${client.user.tag}`);
    
    const commands = [
        { name: 'zemon-setup', description: 'สร้างหน้า Panel แจกสคริปต์ให้สมาชิก' },
        { name: 'zemon-admin', description: 'สร้างหน้า Panel สำหรับจัดการสคริปต์ (เฉพาะซีม่อน)' }
    ];

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    } catch (error) { console.error(error); }
});

client.on('interactionCreate', async interaction => {
    // --- 1. หน้า Panel สำหรับสมาชิก ---
    if (interaction.commandName === 'zemon-setup') {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'เฉพาะซีม่อนนะค้าบ', ephemeral: true });
        await sendMemberPanel(interaction, false);
    }

    // --- 2. หน้า Admin สำหรับเติมสคริปต์ ---
    if (interaction.commandName === 'zemon-admin') {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'เฉพาะซีม่อนนะค้าบ', ephemeral: true });
        
        const adminEmbed = new EmbedBuilder()
            .setTitle('⚙️ SWIFT HUB - ADMIN SYSTEM')
            .setDescription('ยินดีต้อนรับค่ะซีม่อน! กดปุ่มด้านล่างเพื่อเติมสคริปต์ใหม่เข้าระบบได้เลย')
            .setColor('#ff69b4')
            .addFields({ name: '📊 จำนวนสคริปต์ปัจจุบัน', value: `\`${scriptData.length}\` รายการ` });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('admin_add_btn')
                .setLabel('➕ เติมสคริปต์ใหม่')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({ embeds: [adminEmbed], components: [row] });
    }

    // --- 3. จัดการปุ่ม Admin Add ---
    if (interaction.isButton() && interaction.customId === 'admin_add_btn') {
        const modal = new ModalBuilder().setCustomId('modal_add_script').setTitle('📝 เพิ่มข้อมูลสคริปต์');
        
        const nInput = new TextInputBuilder().setCustomId('in_name').setLabel("ชื่อสคริปต์").setStyle(TextInputStyle.Short).setRequired(true);
        const cInput = new TextInputBuilder().setCustomId('in_code').setLabel("โค้ดสคริปต์").setStyle(TextInputStyle.Paragraph).setRequired(true);
        const iInput = new TextInputBuilder().setCustomId('in_img').setLabel("ลิงก์รูปภาพ (Discord Link เท่านั้น)").setStyle(TextInputStyle.Short).setRequired(false);

        modal.addComponents(new ActionRowBuilder().addComponents(nInput), new ActionRowBuilder().addComponents(cInput), new ActionRowBuilder().addComponents(iInput));
        await interaction.showModal(modal);
    }

    // --- 4. บันทึกสคริปต์จาก Modal ---
    if (interaction.isModalSubmit() && interaction.customId === 'modal_add_script') {
        const name = interaction.fields.getTextInputValue('in_name');
        const code = interaction.fields.getTextInputValue('in_code');
        const image = interaction.fields.getTextInputValue('in_img') || null;
        
        scriptData.push({ name, code, image });
        await interaction.reply({ content: `✅ บันทึกสคริปต์ **${name}** เรียบร้อยแล้วค่ะที่รัก!`, ephemeral: true });
    }

    // --- 5. จัดการ Dropdown เลือกสคริปต์ ---
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_script') {
        userSelections.set(interaction.user.id, interaction.values[0]);
        await interaction.deferUpdate(); 
    }

    // --- 6. จัดการปุ่มรับสคริปต์ (แก้ไข Delay ลบข้อความ & รีเซ็ตหน้าจอ) ---
    if (interaction.isButton() && interaction.customId === 'get_script_btn') {
        const selIdx = userSelections.get(interaction.user.id);
        
        // แก้ไขให้ขึ้นชื่อคนกดแทนชื่อซีม่อน
        if (selIdx === undefined) {
            return interaction.reply({ 
                content: `❌ คุณ <@${interaction.user.id}> ต้องเลือกสคริปต์จากรายการก่อนนะค้าบ!`, 
                ephemeral: true 
            });
        }

        const script = scriptData[parseInt(selIdx)];
        
        const resEmbed = new EmbedBuilder()
            .setTitle(`✨ สคริปต์ของคุณ: ${script.name}`)
            .setDescription(`จิ้มที่โค้ดด้านล่างเพื่อคัดลอกได้เลย:\n\n\`${script.code}\`\n\n*(ข้อความนี้จะลบอัตโนมัติใน 1 นาที)*`)
            .setColor('#2b2d31');
        
        if (script.image) resEmbed.setImage(script.image);

        // ส่งข้อความสคริปต์แบบเห็นคนเดียว
        await interaction.reply({ embeds: [resEmbed], ephemeral: true });

        // เริ่มนับถอยหลัง 1 นาที (60000ms) ก่อนจะทำการเคลียร์ทุกอย่าง
        setTimeout(async () => {
            try {
                // 1. ลบตัวเลือกในหน่วยความจำ
                userSelections.delete(interaction.user.id);
                
                // 2. ลบข้อความสคริปต์ที่ส่งให้ (Ephemeral)
                await interaction.deleteReply().catch(() => {});
                
                // 3. รีเซ็ตหน้าจอ Panel หลักให้กลับเป็นค่าเริ่มต้น (ไม่ให้ชื่อสคริปต์ค้างในดรอปดาวน์)
                await sendMemberPanel(interaction, true);
            } catch (e) {
                console.log("Error during reset delay:", e);
            }
        }, 60000);
    }
});

// ฟังก์ชันสำหรับสร้าง/อัปเดตหน้า Panel สมาชิก
async function sendMemberPanel(interaction, isEdit) {
    const embed = new EmbedBuilder()
        .setTitle('💎 SWIFT HUB - SCRIPT CENTER')
        .setDescription('━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
                        '👋 **ยินดีต้อนรับสู่ระบบแจกสคริปต์**\n' +
                        '1️⃣ เลือกสคริปต์ที่ต้องการในเมนูด้านล่าง\n' +
                        '2️⃣ กดปุ่มสีเขียวเพื่อรับโค้ดรันสคริปต์\n\n' +
                        '📌 *หมายเหตุ: จิ้มที่ตัวโค้ดเพื่อคัดลอกทันที*\n\n' +
                        '━━━━━━━━━━━━━━━━━━━━━━━━━━')
        .setColor('#00ff7f')
        .setThumbnail('https://cdn.discordapp.com/emojis/1105151516052062258.webp') 
        .setFooter({ text: 'Powered by Pai & Zemon • 24/7 Service' });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_script')
        .setPlaceholder('📂 --- คลิกเพื่อเลือกสคริปต์ที่นี่ ---')
        .addOptions(scriptData.length > 0 ? scriptData.map((s, index) => ({
            label: `📜 ${s.name}`,
            description: `กดเพื่อเลือกสคริปต์ ${s.name}`,
            value: index.toString(),
        })) : [{ label: 'ยังไม่มีสคริปต์ในระบบ', value: 'none' }]);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('get_script_btn').setLabel('📥 รับสคริปต์ (Get Script)').setStyle(ButtonStyle.Success)
    );

    if (isEdit) {
        // ใช้การแก้ไขข้อความเดิมของบอทเพื่อรีเซ็ตหน้าจอ
        await interaction.message.edit({ embeds: [embed], components: [row1, row2] }).catch(() => {});
    } else {
        await interaction.reply({ embeds: [embed], components: [row1, row2] });
    }
}

client.login(TOKEN);
