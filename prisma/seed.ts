import { CompostStand, PrismaClient } from '@prisma/client'
import { standsIdToNameMap } from '../constants/compostStands';
const prisma = new PrismaClient()
async function main() {
    try {
        // Create compost stands using upsert to handle existing records
        for (const [key, val] of Object.entries(standsIdToNameMap)) {
            await prisma.compostStand.upsert({
                where: {
                    compostStandId: parseInt(key)
                },
                update: {
                    name: val
                },
                create: {
                    name: val,
                    compostStandId: parseInt(key)
                }
            });
        }

        const liraShapira = await prisma.user.upsert({
            where: {
                phoneNumber: '000'
            },
            update: {
                lastName: 'SHAPIRA',
                firstName: 'LIRA'
            },
            create: {
                lastName: 'SHAPIRA',
                firstName: 'LIRA',
                phoneNumber: '000'
            },
        })
        console.log('LIRA_SHAPIRA_USER_ID: ', liraShapira.id )
    } catch (e) {
        console.log(e)
    }


}
main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
