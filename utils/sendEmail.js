const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, html, text }) => {
    try {
        const host = process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com';
        const port = process.env.SMTP_PORT || process.env.EMAIL_PORT || 465;
        const user = (process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
        const rawPass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || '').trim();
        const pass = rawPass.replace(/\s+/g, '');
        const from = process.env.EMAIL_FROM && process.env.EMAIL_FROM.includes('@') 
            ? process.env.EMAIL_FROM 
            : `"Balouch Tailors" <${user || 'balouchtaylors110@gmail.com'}>`;

        if (!user || !pass) {
            console.log('⚠️ [EMAIL SERVICE] SMTP Credentials not configured in .env.');
            console.log(`✉️ Simulated Email to: ${to}`);
            console.log(`📌 Subject: ${subject}`);
            console.log(`📝 Content Preview: ${text || html?.substring(0, 150)}...`);
            return {
                simulated: true,
                message: 'SMTP not configured, email simulated in console.'
            };
        }

        const isGmail = host.includes('gmail') || user.endsWith('@gmail.com');
        const transporterConfig = isGmail 
            ? {
                service: 'gmail',
                auth: {
                    user,
                    pass
                }
            }
            : {
                host,
                port: Number(port),
                secure: Number(port) === 465,
                auth: {
                    user,
                    pass
                }
            };

        const transporter = nodemailer.createTransport(transporterConfig);

        const mailOptions = {
            from,
            to,
            subject,
            text,
            html
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ [EMAIL SERVICE] Email sent successfully to ${to}: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error('❌ [EMAIL SERVICE ERROR]:', error.message);
        throw new Error(`Failed to send email: ${error.message}`);
    }
};

module.exports = sendEmail;
