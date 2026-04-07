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

// ตัวเก็บข้อมูลสคริปต์ (ชื่อ และ โค้ด)
let scriptData = []; 
// ตัวเก็บว่าใครกำลังเลือกสคริปต์ไหนอยู่ (ใช้เก็บชั่วคราว)
const userSelections = new Map();

client.once('ready', async () => {
    console.log(`Pai is ready! Logged in as ${client.user.tag}`);
    
    const commands = [
        new SlashCommandBuilder()
            .setName('zemon-setup') // เปลี่ยนชื่อคำสั่งให้เท่ๆ ตามใจซีม่อน
            .setDescription('สร้างหน้า Panel แจกสคริปต์ (เฉพาะซีม่อน)'),
        new SlashCommandBuilder()
            .setName('zemon-add') // คำสั่งหลังบ้านสำหรับเติมสคริปต์
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
    // 1. คำสั่งสร้าง Panel (/zemon-setup)
    if (interaction.commandName === 'zemon-setup') {
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: 'คำสั่งนี้เฉพาะซีม่อนเท่านั้นนะค้าบ!', ephemeral: true });
        }

        if (scriptData.length === 0) {
            return interaction.reply({ content: 'ยังไม่มีสคริปต์ในระบบเลยซีม่อน เติมสคริปต์ก่อนนะค้าบ!', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('💎 SWIFT HUB - SCRIPT CENTER')
            .setDescription('เลือกสคริปต์ที่ต้องการจากรายการด้านล่าง แล้วกดปุ่มรับโค้ดได้เลย!\n(จิ้มที่โค้ดเพื่อคัดลอกอัตโนมัติ)')
            .setColor('#2b2d31')
            .setFooter({ text: 'Powered by Pai & Zemon' });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_script')
            .setPlaceholder('--- เลือกรายชื่อสคริปต์ที่นี่ ---')
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

    // 2. คำสั่งเพิ่มสคริปต์หลังบ้าน (/zemon-add)
    if (interaction.commandName === 'zemon-add') {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'เฉพาะซีม่อนนะจ๊ะ', ephemeral: true });

        const modal = new ModalBuilder()
            .setCustomId('add_script_modal')
            .setTitle('เติมสคริปต์เข้า Panel');

        const nameInput = new TextInputBuilder()
            .setCustomId('script_name')
            .setLabel("ชื่อสคริปต์ (จะแสดงใน Dropdown)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const codeInput = new TextInputBuilder()
            .setCustomId('script_code')
            .setLabel("โค้ดสคริปต์ (ใส่โค้ดที่นี่ได้เลย)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(codeInput));
        await interaction.showModal(modal);
    }

    // จัดการการส่ง Modal (บันทึกสคริปต์)
    if (interaction.isModalSubmit() && interaction.customId === 'add_script_modal') {
        const name = interaction.fields.getTextInputValue('script_name');
        const code = interaction.fields.getTextInputValue('script_code');
        
        scriptData.push({ name, code });
        await interaction.reply({ content: `✅ บันทึกสคริปต์ "${name}" เรียบร้อย! ตอนนี้ใน Dropdown จะมีชื่อนี้ขึ้นแล้วนะซีม่อน`, ephemeral: true });
    }

    // จัดการเมื่อมีการเลือก Dropdown
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_script') {
        userSelections.set(interaction.user.id, interaction.values[0]);
        await interaction.reply({ content: `เลือกสคริปต์เรียบร้อย! อย่าลืมกดปุ่มสีเขียวเพื่อรับโค้ดนะค้าบ`, ephemeral: true });
    }

    // จัดการเมื่อกดปุ่มรับสคริปต์
    if (interaction.isButton() && interaction.customId === 'get_script_btn') {
        const selectionIndex = userSelections.get(interaction.user.id);
        
        if (selectionIndex === undefined) {
            return interaction.reply({ content: 'ซีม่อนต้องเลือกสคริปต์จากรายการด้านบนก่อนนะค้าบ!', ephemeral: true });
        }

        const script = scriptData[parseInt(selectionIndex)];
        
        // ส่งข้อความแบบ Ephemeral (เห็นคนเดียว) 
        // ใส่เครื่องหมาย ` คร่อมหัวท้ายเพื่อให้กดจิ้มแล้วคัดลอกอัตโนมัติในมือถือ
        await interaction.reply({ 
            content: `✨ **ชื่อสคริปต์:** ${script.name}\n\nจิ้มที่โค้ดด้านล่างเพื่อคัดลอกได้เลย:\n\`${script.code}\``, 
            ephemeral: true 
        });
    }
});

client.login(TOKEN);
