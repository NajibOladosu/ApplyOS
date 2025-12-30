import { config } from 'dotenv';
import path from 'path';

// Load .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const { sendEmailViaSMTP } = await import('./lib/email/transport');

    const recipient = 'najibaioladosu@gmail.com';
    console.log(`Sending Round 2 test email to: ${recipient}`);

    try {
        const result = await sendEmailViaSMTP(
            recipient,
            '📩 ApplyOS: Deliverability Check (Round 2)',
            '<h1>DMARC Setup Complete</h1><p>This is a final test email following the DMARC record update. If you receive this in your Inbox, the setup is officially perfect!</p>'
        );

        if (result && result.messageId) {
            console.log('\n🚀 SUCCESS: Email sent successfully!');
            console.log(`Message ID: ${result.messageId}`);
        } else {
            console.log('\n❌ FAILED: Could not send email.');
            process.exit(1);
        }
    } catch (error) {
        console.error('\n💥 ERROR during sending:');
        console.error(error);
        process.exit(1);
    }
}

main();
