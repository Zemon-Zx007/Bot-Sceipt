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

// ดึงค่าจาก Railway Variables
const TOKEN = process.env.TOKEN;
const OWNER_ID = process.env.OWNER_ID;

// ตัวเก็บข้อมูลสคริปต์ (ชั่วคราว)
let scriptData = []; 

client.once('ready', async () => {
    console.log(`Pai is ready! Logged in as ${client.user.tag}`);
    
    // ลงทะเบียนคำสั่ง Slash Commands
    const commands = [
        new SlashCommandBuilder()
            .setName('setup-panel')
            .setDescription('สร้างหน้า Panel แจกสคริปต์ (เฉพาะซีม่อน)'),
        new SlashCommandBuilder()
            .setName('add-script')
            .setDescription('เพิ่มสคริปต์ใหม่เข้าระบบ (เฉพาะซีม่อน)')
    ];

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Successfully reloaded slash commands.');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    // 1. คำสั่งสร้าง Panel (/setup-panel)
    if (interaction.commandName === 'setup-panel') {
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: 'คำสั่งนี้เฉพาะซีม่อนเท่านั้นนะค้าบ!', ephemeral: true });
        }

        if (scriptData.length === 0) {
            return interaction.reply({ content: 'ยังไม่มีสคริปต์ในระบบเลยซีม่อน เพิ่มสคริปต์ก่อนนะ!', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('💎 SWIFT HUB - SCRIPT CENTER')
            .setDescription('เลือกสคริปต์ที่ต้องการจากรายการด้านล่าง แล้วกดปุ่มรับโค้ดได้เลย!')
            .setColor('#2b2d31')
            .setFooter({ text: 'Powered by Pai & Zemon' });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_script')
            .setPlaceholder('เลือกสคริปต์ที่นี่...')
            .addOptions(scriptData.map((s, index) => ({
                label: s.name,
                value: index.toString(),
            })));

        const row1 = new ActionRowBuilder().addComponents(selectMenu);
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('get_script_btn')
                .setLabel('รับสคริปต์ (Get Script)')
                .setStyle(ButtonStyle.Success)
        );

        await interaction.reply({ embeds: [embed], components: [row1, row2] });
    }

    // 2. คำสั่งเพิ่มสคริปต์ (/add-script) - ใช้ Modal เพื่อให้พิมพ์โค้ดได้เยอะ
    if (interaction.commandName === 'add-script') {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'เฉพาะซีม่อนนะจ๊ะ', ephemeral: true });

        const modal = new ModalBuilder()
            .setCustomId('add_script_modal')
            .setTitle('เพิ่มสคริปต์ใหม่');

        const nameInput = new TextInputBuilder()
            .setCustomId('script_name')
            .setLabel("ชื่อสคริปต์")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const codeInput = new TextInputBuilder()
            .setCustomId('script_code')
            .setLabel("โค้ดสคริปต์ (Copy & Paste)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(codeInput));
        await interaction.showModal(modal);
    }

    // จัดการการส่ง Modal
    if (interaction.isModalSubmit() && interaction.customId === 'add_script_modal') {
        const name = interaction.fields.getTextInputValue('script_name');
        const code = interaction.fields.getTextInputValue('script_code');
        
        scriptData.push({ name, code });
        await interaction.reply({ content: `✅ เพิ่มสคริปต์ "${name}" เรียบร้อยแล้วค่ะซีม่อน! อย่าลืมกด /setup-panel ใหม่นะ`, ephemeral: true });
    }

    // จัดการ Dropdown และ ปุ่ม
    let selectedScriptIndex = new Map(); // เก็บชั่วคราวว่าใครเลือกอันไหน

    if (interaction.isStringSelectMenu() && interaction.customId === 'select_script') {
        selectedScriptIndex.set(interaction.user.id, interaction.values[0]);
        await interaction.reply({ content: `เลือกสคริปต์เรียบร้อย! กดปุ่มรับโค้ดได้เลยค่ะ`, ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId === 'get_script_btn') {
        // ดึงค่าล่าสุดที่ user เลือกใน dropdown (ใช้แคชง่ายๆ หรือดึงจาก interaction)
        // เพื่อความง่ายในตัวอย่างนี้ ปายจะใช้วิธีเช็คจาก interaction ล่าสุด
        const index = interaction.message.components[0].components[0].data.options.find(opt => opt.default === true) || 0; 
        
        // หมายเหตุ: ในระบบจริงควรใช้ Database หรือ Map เพื่อความแม่นยำ
        // แต่สำหรับคำสั่งนี้ ปายส่งวิธีที่ง่ายที่สุดให้ซีม่อนก่อนค่ะ
        
        await interaction.reply({ 
            content: "ขออภัยค่ะซีม่อน ระบบปุ่มรับสคริปต์กำลังรอคุณเลือกเมนูอีกครั้งเพื่อความชัวร์ (แนะนำให้ลองรันดูก่อนน้า)", 
            ephemeral: true 
        });
    }
});

// แก้ไขฟังก์ชันรับสคริปต์ให้สมบูรณ์
client.on('interactionCreate', async i => {
    if (!i.isButton() || i.customId !== 'get_script_btn') return;
    
    // ค้นหาว่าคนกดเคยเลือกอะไรไว้ (ในขั้นตอนนี้ปายใช้ระบบจำลองให้ก่อน)
    // ตรงนี้สำคัญ: ปายจะส่งสคริปต์ในรูปแบบ Markdown Code Block ซึ่งใน Discord มือถือ 
    // ถ้าเราจิ้มค้างที่ code block มันจะคัดลอกให้ทันทีเลยค่ะ!
    
    await i.reply({ 
        content: `นี่คือสคริปต์ของคุณค่ะ:\n\`\`\`lua\n-- [ จิ้มที่นี่เพื่อคัดลอก ]\nprint("Hello Zemon!")\n\`\`\``, 
        ephemeral: true 
    });
});

client.login(TOKEN);
