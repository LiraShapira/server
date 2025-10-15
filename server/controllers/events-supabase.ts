import { Request, Response } from "express"
import { AttendeeRole } from '@prisma/client';
import { supabase } from '../config/supabase';
import { DateTime } from "luxon";

type RequestBody<T> = Request<{}, {}, T>;

interface EventDTO {
  startDate: string;
  endDate: string;
  title: string;
  description: string;
  location: { id: string }
}

export const addEvent = async (req: RequestBody<EventDTO>, res: Response) => {
  const reqEvent: EventDTO = req.body;

  const luxonStartDateString = DateTime.fromISO(reqEvent.startDate).toString();
  const luxonEndDateString = DateTime.fromISO(reqEvent.endDate).toString();

  const newEvent = {
    startDate: luxonStartDateString,
    endDate: luxonEndDateString,
    title: reqEvent.title,
    description: reqEvent.description,
    locationId: reqEvent.location.id
  }

  try {
    const { data: event, error } = await supabase
      .from('Event')
      .insert(newEvent)
      .select(`
        *,
        attendees:Attendee(*),
        location:Location(*)
      `)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json(event);
  } catch (e: any) {
    console.error(e);
    res.status(400).send({ error: e.message });
  }
}

interface AddAttendeeArgs {
  attendee: {
    userId: string;
    role: AttendeeRole,
    productsForSale?: string[],
  };
  eventId: string
}

export const addAttendee = async (req: RequestBody<AddAttendeeArgs>, res: Response) => {
  const { attendee, eventId } = req.body;

  try {
    // Check if attendee already exists
    const { data: existingAttendee, error: checkError } = await supabase
      .from('Attendee')
      .select('*')
      .eq('userId', attendee.userId)
      .eq('eventId', eventId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Supabase error checking attendee:', checkError);
      return res.status(400).json({ error: checkError.message });
    }

    if (existingAttendee) {
      // Update the existing attendee
      const { error: updateError } = await supabase
        .from('Attendee')
        .update({
          role: attendee.role,
          productsForSale: attendee.productsForSale || []
        })
        .eq('userId', attendee.userId)
        .eq('eventId', eventId);

      if (updateError) {
        console.error('Supabase error updating attendee:', updateError);
        return res.status(400).json({ error: updateError.message });
      }
    } else {
      // Create new attendee
      const { error: insertError } = await supabase
        .from('Attendee')
        .insert({
          userId: attendee.userId,
          role: attendee.role,
          productsForSale: attendee.productsForSale || [],
          eventId: eventId
        });

      if (insertError) {
        console.error('Supabase error creating attendee:', insertError);
        return res.status(400).json({ error: insertError.message });
      }
    }

    // Return upcoming events
    getUpcomingEvents(req, res);
  } catch (e: any) {
    console.error(e);
    res.status(400).send({ error: e.message });
  }
}

interface RemoveAttendeeArgs {
  userId: string;
  eventId: string;
}

export const removeAttendee = async (req: RequestBody<RemoveAttendeeArgs>, res: Response) => {
  const { userId, eventId } = req.body;

  try {
    const { error } = await supabase
      .from('Attendee')
      .delete()
      .eq('userId', userId)
      .eq('eventId', eventId);

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).send({ error: 'Attendee not found' });
      }
      console.error('Supabase error:', error);
      return res.status(400).json({ error: error.message });
    }

    getUpcomingEvents(req, res);
  } catch (e: any) {
    console.error(e);
    res.status(400).send({ error: e.message });
  }
}

export const getAllEvents = async (_req: Request, res: Response) => {
  try {
    const { data: events, error } = await supabase
      .from('Event')
      .select(`
        *,
        location:Location(*),
        attendees:Attendee(
          *,
          user:User(*)
        )
      `);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json(events);
  } catch (e: any) {
    console.error(e);
    res.status(400).send({ error: e.message });
  }
}

export const getUpcomingEvents = async (_req: RequestBody<any>, res: Response) => {
  try {
    const { data: events, error } = await supabase
      .from('Event')
      .select(`
        *,
        location:Location(*),
        attendees:Attendee(
          *,
          user:User(*)
        )
      `)
      .gte('endDate', new Date().toISOString());

    if (error) {
      console.error('Supabase error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).send(events);
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
}

export const getLocations = async (_req: Request, res: Response) => {
  try {
    const { data: locations, error } = await supabase
      .from('Location')
      .select('*');

    if (error) {
      console.error('Supabase error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).send(locations);
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
}

export const deleteEvent = async (req: RequestBody<{ id: string }>, res: Response) => {
  try {
    const { error } = await supabase
      .from('Event')
      .delete()
      .eq('id', req.body.id);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(400).json({ error: error.message });
    }

    getUpcomingEvents(req, res);
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
}

interface UpdateEventReqBody {
  id: string;
  startDate: string;
  endDate: string;
  title: string;
  description: string;
  location: {
    id: string;
  }
}

export const updateEvent = async (req: RequestBody<UpdateEventReqBody>, res: Response) => {
  try {
    const { id, location, ...eventData } = req.body;

    // Update the event
    const { error: eventError } = await supabase
      .from('Event')
      .update({
        ...eventData,
        locationId: location.id
      })
      .eq('id', id);

    if (eventError) {
      console.error('Supabase error updating event:', eventError);
      return res.status(400).json({ error: eventError.message });
    }

    // Update the location if needed
    const { error: locationError } = await supabase
      .from('Location')
      .update(location)
      .eq('id', location.id);

    if (locationError) {
      console.error('Supabase error updating location:', locationError);
      return res.status(400).json({ error: locationError.message });
    }

    getUpcomingEvents(req, res);
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
}
