const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { applyDatabaseUrlEnv } = require('../src/utils/databaseUrl');

applyDatabaseUrlEnv();

const prisma = new PrismaClient();

async function main() {
    const clientName = process.env.SUPERADMIN_CLIENT_NAME || 'Safetynett';
    const adminEmail = String(process.env.SUPERADMIN_EMAIL || 'admin@safetynet.com')
        .trim()
        .toLowerCase();
    const adminPassword = String(process.env.SUPERADMIN_PASSWORD || 'AdminPass1!').trim();
    const resetPassword =
        process.env.SUPERADMIN_RESET_PASSWORD === 'true' ||
        process.env.SUPERADMIN_RESET_PASSWORD === '1';

    if (!adminEmail || !adminPassword) {
        throw new Error('SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be non-empty when seeding.');
    }

    // 1. Create default client (required for superadmin FK)
    let client = await prisma.client.findUnique({
        where: { name: clientName },
    });

    if (!client) {
        client = await prisma.client.create({
            data: {
                name: clientName,
                logo: null,
            },
        });
        console.log(`Created client: ${client.name}`);
    } else {
        console.log(`Client ${client.name} already exists.`);
    }

    // 2. Create or update super admin
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    let admin = await prisma.user.findFirst({
        where: { email: { equals: adminEmail, mode: 'insensitive' } },
    });

    if (!admin) {
        admin = await prisma.user.create({
            data: {
                username: process.env.SUPERADMIN_USERNAME || 'superadmin',
                firstName: 'Super',
                lastName: 'Admin',
                email: adminEmail,
                password: hashedPassword,
                role: 'superadmin',
                active: true,
                emailVerified: true,
                clientId: client.id,
                companyname: client.name,
                mobile: process.env.SUPERADMIN_MOBILE || '1234567890',
                jobTitle: 'System Administrator',
            },
        });
        console.log(`Created platform superadmin: ${admin.email}`);
    } else {
        console.log(`Platform admin ${admin.email} already exists.`);
        const updates = {};
        if (admin.role !== 'superadmin') {
            updates.role = 'superadmin';
        }
        if (!admin.active) {
            updates.active = true;
        }
        if (resetPassword) {
            updates.password = hashedPassword;
            console.log(`Reset superadmin password for ${admin.email}`);
        }
        if (Object.keys(updates).length > 0) {
            admin = await prisma.user.update({
                where: { id: admin.id },
                data: updates,
            });
            if (updates.role) {
                console.log('Updated platform admin role to superadmin');
            }
        }
    }
}

(async () => {
    try {
        await main();
    } catch (e) {
        console.error(e);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
    process.exit(process.exitCode ?? 0);
})();
