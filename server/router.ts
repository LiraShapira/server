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
  toggleBanUser,
  deleteUser
} from './controllers/users';
import {
  addMultipleCompostStands,
  addCompostStand,
  updateCompostStand,
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
  updateTransaction,
  backfillMissingCompostReports,
} from './controllers/transactions';
import { getAllCompostStandAdmins, removeCompostStandAdmin, addCompostStandAdmin } from './controllers/compostStandAdmins';
import { addAttendee, addEvent, addLocation, deleteEvent, getUpcomingEvents, getLocations, getAllEvents, updateEvent, removeAttendee } from './controllers/events';
import { checkVerify, startVerify } from './controllers/twilio';
import { checkDatabaseHealth } from './utils/healthCheck';
import { getVerificationMessage } from './controllers/verificationMessages';
import { getCommunities, getCommunityById } from './controllers/communities';
import { login, logout, getCurrentAdmin } from './controllers/admin';
import { authenticateAdmin } from './middleware/auth';

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

// ADMIN AUTHENTICATION
router.post('/admin/login', login);
router.post('/admin/logout', logout);
router.get('/admin/me', authenticateAdmin, getCurrentAdmin);

// COMMUNITIES
router.get('/communities', getCommunities);
router.get('/community/:id', getCommunityById);

// USER OPERATIONS
router.get('/users', getAllUsers);
router.post('/user', getUser);
router.post('/userIdByNumber', getUserByNumber);
router.post('/register', saveNewUser);
router.post('/verifyUser', verifyUser);
router.post('/toggleBanUser', toggleBanUser);
router.post('/deleteUser', deleteUser);

// COMPOST STAND OPERATIONS
router.get('/compostStands', getCompostStands);
router.post('/compostStand', addCompostStand);
router.put('/compostStand', updateCompostStand);
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
router.post('/admin/backfillCompostReports', authenticateAdmin, backfillMissingCompostReports);

// COMPOST REPORTS
router.get("/getCompostReports", getCompostReports);

// TWILIO
router.post('/startVerify', startVerify);
router.post('/checkVerify', checkVerify);

// VERIFICATION MESSAGES
router.get('/verificationMessage', getVerificationMessage);

// EVENTS
router.get('/allEvents', getAllEvents);
router.get('/events', getUpcomingEvents);
router.get('/locations', getLocations);
router.post('/addLocation', addLocation);
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
