import { Router } from 'express';
import {
  getAllUsers,
  deleteAllusers,
  getUser,
  saveNewUser,
  deleteUserByPhoneNumber,
  userStats,
  getUserByNumber
} from './controllers/users';
import {
  addMultipleCompostStands,
  addCompostStand,
  deleteAllCompostStands,
  getCompostStands,
  setUsersLocalStand,
  compostStandStats,
  monthlyCompostStandStats,
  getCompostReports,
  getCompostReportsStats,
} from './controllers/compostStands';
import {
  getAllTransactions,
  saveNewTransaction,
  saveDeposit,
  transactionStats,
  handleRequest
} from './controllers/transactions';
import { getAllCompostStandAdmins, removeCompostStandAdmin, addCompostStandAdmin } from './controllers/compostStandAdmins';
import { addAttendee, addEvent, deleteEvent, getUpcomingEvents, getLocations, getAllEvents, updateEvent, removeAttendee } from './controllers/events';
import { checkVerify, startVerify } from './controllers/twilio';

const router = Router();

// USER OPERATIONS
router.get('/users', getAllUsers);
router.post('/user', getUser);
router.post('/userIdByNumber', getUserByNumber);
router.post('/register', saveNewUser);

// COMPOST STAND OPERATIONS
router.get('/compostStands', getCompostStands);
router.post('/compostStand', addCompostStand);
router.post('/setUsersLocalStand', setUsersLocalStand);

router.get('/getAllCompostStandAdmins', getAllCompostStandAdmins);
router.post('/removeCompostStandAdmin', removeCompostStandAdmin);
router.post('/addCompostStandAdmin', addCompostStandAdmin);

// TRANSACTIONS
router.get('/transactions', getAllTransactions);
router.post('/saveTransaction', saveNewTransaction);
router.post('/deposit', saveDeposit);
router.put('/handleRequest', handleRequest);

// COMPOST REPORTS 
router.get("/getCompostReports", getCompostReports);

// TWILIO
router.post('/startVerify', startVerify);
router.post('/checkVerify', checkVerify);

// EVENTS
router.get('/allEvents', getAllEvents);
router.get('/events', getUpcomingEvents);
router.get('/locations', getLocations);
router.post('/addEvent', addEvent);
router.post('/addAttendee', addAttendee);
router.delete('/removeAttendee', removeAttendee);
router.delete('/deleteEvent', deleteEvent);
router.post('/updateEvent', updateEvent);

// STATS
router.get('/userStats', userStats)
router.get('/transactionStats', transactionStats)
router.get('/compostStandStats', compostStandStats)
router.get("/compostReportStats", getCompostReportsStats);


router.get('/monthlyCompostStandStats', monthlyCompostStandStats)

export default router;
