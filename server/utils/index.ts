import { $Enums, Prisma } from "@prisma/client";
import { prisma } from "..";
import { UserWithTransactionsCount } from "../../types/userTypes";
import { DepositDTO } from "../../types/transactionTypes";
import { standsNameToIdMap } from "../../constants/compostStands";

export const findUserIdByPhoneNumber = async (phoneNumber: string): Promise<string> => {
    try {

        const user = await prisma.user.findUnique({ where: { phoneNumber: phoneNumber } });
        if (!user) {
            throw new Error('No user exists for this number');
        }
        return user.id;
    } catch (error: any) {
        throw new Error(error);
    }
}

export const convertUserWithTransactionsCountToCountArray = (userWithTransactionsCount: UserWithTransactionsCount[]): number[] => {
    return userWithTransactionsCount.map(n => n._count.transactions);
}

export const convertDepositDTOToCompostReportData = (depositDTO: DepositDTO): Prisma.CompostReportUncheckedCreateInput => {
    const { compostReport, userId } = depositDTO;
    const {
        compostStand,
        depositWeight,
        dryMatter,
        notes,
        bugs,
        scalesProblem,
        full,
        cleanAndTidy,
        compostSmell,
    } = compostReport;

    return {
        depositWeight: new Prisma.Decimal(depositWeight),
        dryMatterPresent:
            dryMatter === undefined ? undefined : dryMatter ? "yes" : "no",
        notes,
        bugs,
        scalesProblem,
        full,
        cleanAndTidy,
        compostSmell,
        compostStandId: standsNameToIdMap[compostStand],
        userId,
    };
};

export const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];