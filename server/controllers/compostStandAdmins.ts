import { Request, Response } from "express";
import { supabase } from "../config/supabase";
import { CompostStandAdminsReq } from "../../types/compostStand";

export async function addCompostStandAdmin(req: Request<CompostStandAdminsReq>, res: Response) {
    const { userId: id, compostStandId } = req.body;
    try {
        // Check if compost stand exists
        const { data: compostStand, error: standError } = await supabase
            .from('CompostStand')
            .select(`
                *,
                admins:User!User_adminCompostStandId_fkey(id)
            `)
            .eq('compostStandId', compostStandId)
            .single();

        if (standError || !compostStand) {
            console.error('Supabase error fetching compost stand:', standError);
            return res.status(404).json({ error: 'CompostStand not found' });
        }

        // Check if user is already an admin
        const isAlreadyAdmin = compostStand.admins?.some((admin: any) => admin.id === id);
        if (isAlreadyAdmin) {
            return res.status(400).json({ error: 'User is already an admin of this compost stand' });
        }

        // Add user as admin by updating the user's adminCompostStandId
        const { data: updatedUser, error: updateError } = await supabase
            .from('User')
            .update({
                adminCompostStandId: compostStandId
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('Supabase error updating user:', updateError);
            return res.status(400).json({ error: updateError.message });
        }

        // Fetch the updated compost stand with all admins (specify the relationship explicitly)
        const { data: updatedStand, error: fetchError } = await supabase
            .from('CompostStand')
            .select(`
                *,
                admins:User!User_adminCompostStandId_fkey(*)
            `)
            .eq('compostStandId', compostStandId)
            .single();

        if (fetchError) {
            console.error('Supabase error fetching updated stand:', fetchError);
            return res.status(400).json({ error: fetchError.message });
        }

        res.status(201).send(updatedStand);
    } catch (e: any) {
        console.error('Error in addCompostStandAdmin:', e);
        res.status(400).json({ error: e.message });
    }
}

export async function removeCompostStandAdmin(req: Request<CompostStandAdminsReq>, res: Response) {
    const { compostStandId, userId } = req.body;
    try {
        // Check if compost stand exists and get admins
        const { data: compostStand, error: standError } = await supabase
            .from('CompostStand')
            .select(`
                *,
                admins:User!User_adminCompostStandId_fkey(id)
            `)
            .eq('compostStandId', compostStandId)
            .single();

        if (standError || !compostStand) {
            console.error('Supabase error fetching compost stand:', standError);
            return res.status(404).json({ error: 'CompostStand not found' });
        }

        const isAdmin = compostStand.admins?.some((admin: any) => admin.id === userId);

        if (!isAdmin) {
            return res.status(400).json({ error: 'Provided user is not an admin of the provided compost stand' });
        }

        // Remove user as admin by setting their adminCompostStandId to null
        const { data: updatedUser, error: updateError } = await supabase
            .from('User')
            .update({
                adminCompostStandId: null
            })
            .eq('id', userId)
            .select()
            .single();

        if (updateError) {
            console.error('Supabase error updating user:', updateError);
            return res.status(400).json({ error: updateError.message });
        }

        // Fetch the updated compost stand with remaining admins
        const { data: updatedCompostStand, error: fetchError } = await supabase
            .from('CompostStand')
            .select(`
                *,
                admins:User!User_adminCompostStandId_fkey(*)
            `)
            .eq('compostStandId', compostStandId)
            .single();

        if (fetchError) {
            console.error('Supabase error fetching updated stand:', fetchError);
            return res.status(400).json({ error: fetchError.message });
        }

        res.status(201).send(updatedCompostStand);
    } catch (e: any) {
        console.error('Error removing admin from CompostStand:', e);
        res.status(400).json({ error: e.message });
    }
}

export async function getAllCompostStandAdmins(_req: Request, res: Response) {
    try {
        const { data: allCompostStandsWithAdmins, error } = await supabase
            .from('CompostStand')
            .select(`
                *,
                admins:User!User_adminCompostStandId_fkey(*)
            `);

        if (error) {
            console.error('Supabase error:', error);
            return res.status(500).json({ error: error.message });
        }

        const allAdmins = allCompostStandsWithAdmins.flatMap((stand: any) => stand.admins || []);
        res.status(200).send(allAdmins);
    } catch (error: any) {
        console.error('Error retrieving all CompostStand admins:', error);
        res.status(500).json({ error: error.message });
    }
}
