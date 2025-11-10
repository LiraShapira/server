import { Router } from 'express';
import {
  getAllUsers,
  deleteAllusers,
  getUser,
  saveNewUser,
  deleteUserByPhoneNumber,
  userStats,
  getUserByNumber,
  verifyUser,
  toggleBanUser
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
  handleRequest,
  deleteTransaction,
  updateTransaction
} from './controllers/transactions';
import { getAllCompostStandAdmins, removeCompostStandAdmin, addCompostStandAdmin } from './controllers/compostStandAdmins';
import { addAttendee, addEvent, deleteEvent, getUpcomingEvents, getLocations, getAllEvents, updateEvent, removeAttendee } from './controllers/events';
import { checkVerify, startVerify } from './controllers/twilio';
import { checkDatabaseHealth } from './utils/healthCheck';

const router = Router();

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Test endpoint working', timestamp: new Date().toISOString() });
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const dbHealthy = await checkDatabaseHealth();
    if (dbHealthy) {
      res.status(200).json({ 
        status: 'healthy', 
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({ 
        status: 'unhealthy', 
        database: 'disconnected',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// USER OPERATIONS
router.get('/users', getAllUsers);
router.post('/user', getUser);
router.post('/userIdByNumber', getUserByNumber);
router.post('/register', saveNewUser);
router.post('/verifyUser', verifyUser);
router.post('/toggleBanUser', toggleBanUser);

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
router.delete('/transaction/:id', deleteTransaction);
router.put('/transaction', updateTransaction);

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
