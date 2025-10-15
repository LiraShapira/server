import { Request, Response } from "express";
import { supabase } from '../config/supabase';
import { CompostStandAdminsReq } from "../../types/compostStand";

export async function addCompostStandAdmin(req: Request<CompostStandAdminsReq>, res: Response) {
    const { userId: id, compostStandId } = req.body;
    try {
        // First, get the compost stand with its current admins
        const { data: compostStand, error: standError } = await supabase
            .from('CompostStand')
            .select(`
                *,
                admins:User(*)
            `)
            .eq('compostStandId', compostStandId)
            .single();

        if (standError) {
            console.error('Supabase error fetching compost stand:', standError);
            return res.status(400).json({ error: 'CompostStand not found' });
        }

        if (!compostStand) {
            return res.status(400).json({ error: 'CompostStand not found' });
        }

        // Add the user as an admin by updating their adminCompostStandId
        const { data: updatedUser, error: userError } = await supabase
            .from('User')
            .update({ adminCompostStandId: compostStandId })
            .eq('id', id)
            .select()
            .single();

        if (userError) {
            console.error('Supabase error updating user:', userError);
            return res.status(400).json({ error: userError.message });
        }

        // Return the updated compost stand
        const { data: updatedStand, error: updatedStandError } = await supabase
            .from('CompostStand')
            .select(`
                *,
                admins:User(*)
            `)
            .eq('compostStandId', compostStandId)
            .single();

        if (updatedStandError) {
            console.error('Supabase error fetching updated stand:', updatedStandError);
            return res.status(400).json({ error: updatedStandError.message });
        }

        res.status(201).send(updatedStand);
    } catch (e) {
        console.error(e);
        res.status(400).send(e);
    }
}

export async function removeCompostStandAdmin(req: Request<CompostStandAdminsReq>, res: Response) {
    const { compostStandId, userId } = req.body;
    try {
        // First, get the compost stand with its current admins
        const { data: compostStand, error: standError } = await supabase
            .from('CompostStand')
            .select(`
                *,
                admins:User(*)
            `)
            .eq('compostStandId', compostStandId)
            .single();

        if (standError) {
            console.error('Supabase error fetching compost stand:', standError);
            return res.status(400).json({ error: 'CompostStand not found' });
        }

        if (!compostStand) {
            return res.status(400).json({ error: 'CompostStand not found' });
        }

        // Check if the user is actually an admin of this stand
        const isAdmin = compostStand.admins?.some((admin: any) => admin.id === userId);
        if (!isAdmin) {
            return res.status(400).json({ error: 'provided id not admins of provided compost stand' });
        }

        // Remove the user as an admin by setting their adminCompostStandId to null
        const { error: userError } = await supabase
            .from('User')
            .update({ adminCompostStandId: null })
            .eq('id', userId);

        if (userError) {
            console.error('Supabase error updating user:', userError);
            return res.status(400).json({ error: userError.message });
        }

        // Return the updated compost stand
        const { data: updatedStand, error: updatedStandError } = await supabase
            .from('CompostStand')
            .select(`
                *,
                admins:User(*)
            `)
            .eq('compostStandId', compostStandId)
            .single();

        if (updatedStandError) {
            console.error('Supabase error fetching updated stand:', updatedStandError);
            return res.status(400).json({ error: updatedStandError.message });
        }

        res.status(201).send(updatedStand);
    } catch (e) {
        console.error('Error removing admins from CompostStand:', e);
        res.status(400).send(e);
    }
}

export async function getAllCompostStandAdmins(_req: Request, res: Response) {
    try {
        // Get all users who are admins of compost stands
        const { data: allAdmins, error } = await supabase
            .from('User')
            .select(`
                *,
                adminCompostStand:CompostStand(*)
            `)
            .not('adminCompostStandId', 'is', null);

        if (error) {
            console.error('Supabase error fetching admins:', error);
            return res.status(400).json({ error: error.message });
        }

        res.status(200).send(allAdmins || []);
    } catch (error) {
        console.error('Error retrieving all CompostStand admins:', error);
        res.status(400).send(error);
    }
}
