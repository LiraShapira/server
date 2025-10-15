import { supabase } from "../config/supabase";
import { UserWithTransactionsCount } from "../../types/userTypes";
import { DepositDTO } from "../../types/transactionTypes";
import { standsNameToIdMap } from "../../constants/compostStands";
import { randomUUID } from 'crypto';

export const findUserIdByPhoneNumber = async (phoneNumber: string): Promise<string> => {
    try {
        const { data: user, error } = await supabase
            .from('User')
            .select('id')
            .eq('phoneNumber', phoneNumber)
            .single();

        if (error || !user) {
            throw new Error('No user exists for this number');
        }
        return user.id;
    } catch (error: any) {
        throw new Error(error.message || error);
    }
}

export const convertUserWithTransactionsCountToCountArray = (userWithTransactionsCount: UserWithTransactionsCount[]): number[] => {
    return userWithTransactionsCount.map(n => n._count.transactions);
}

export const convertDepositDTOToCompostReportData = (depositDTO: DepositDTO): any => {
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
        compostReportId: randomUUID(),
        depositWeight: depositWeight.toString(),
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