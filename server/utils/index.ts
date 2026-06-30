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

export const convertDepositDTOToCompostReportData = (
    depositDTO: DepositDTO,
    compostStandId?: number,
    communityId?: string | null
): any => {
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

    // Use provided compostStandId if available, otherwise fall back to hardcoded map
    const standId = compostStandId !== undefined
        ? compostStandId
        : standsNameToIdMap[compostStand];

    if (standId === undefined) {
        throw new Error(`Compost stand "${compostStand}" not found and no ID provided`);
    }

    const data: any = {
        compostReportId: randomUUID(),
        date: new Date().toISOString(),
        depositWeight: depositWeight.toString(),
        dryMatterPresent:
            dryMatter === undefined ? undefined : dryMatter ? "yes" : "no",
        notes,
        bugs,
        scalesProblem,
        full,
        cleanAndTidy,
        compostSmell,
        compostStandId: standId,
        userId,
    };
    if (communityId) {
        data.communityId = communityId;
    }
    return data;
};

export const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];