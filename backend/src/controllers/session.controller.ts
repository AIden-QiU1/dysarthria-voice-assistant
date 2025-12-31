/**
 * Session Controller
 * Manages TEN Agent sessions via HTTP API
 */
import { Request, Response, Router } from 'express';
import axios from 'axios';

const router = Router();

// TEN Agent HTTP API配置
const TEN_AGENT_API_URL = process.env.TEN_AGENT_API_URL || 'http://localhost:8080';

/**
 * POST /api/session/start
 * Start a new TEN Agent session
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { userId, hotwords } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Call TEN Agent HTTP API
    const response = await axios.post(`${TEN_AGENT_API_URL}/start`, {
      user_id: userId,
      hotwords: hotwords || []
    });

    const { session_id, websocket_port } = response.data as any;

    // TODO: Save session to Supabase
    // await supabase.from('sessions').insert({
    //   id: session_id,
    //   user_id: userId,
    //   status: 'active',
    //   websocket_port
    // });

    return res.json({
      sessionId: session_id,
      websocketUrl: `ws://localhost:${websocket_port}`,
      status: 'started'
    });
  } catch (error: any) {
    console.error('Failed to start session:', error.message);
    return res.status(500).json({ error: 'Failed to start session' });
  }
});

/**
 * POST /api/session/stop
 * Stop a TEN Agent session
 */
router.post('/stop', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    // Call TEN Agent HTTP API
    const response = await axios.post(`${TEN_AGENT_API_URL}/stop`, {
      session_id: sessionId
    });

    const { success, user_id } = response.data as any;

    // TODO: Update session in Supabase
    // await supabase.from('sessions').update({
    //   status: 'stopped',
    //   ended_at: new Date()
    // }).eq('id', sessionId);

    return res.json({ success, userId: user_id });
  } catch (error: any) {
    console.error('Failed to stop session:', error.message);
    return res.status(500).json({ error: 'Failed to stop session' });
  }
});

/**
 * GET /api/session/:sessionId
 * Get session details
 */
router.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    // TODO: Query session from Supabase
    // const { data, error } = await supabase
    //   .from('sessions')
    //   .select('*')
    //   .eq('id', sessionId)
    //   .single();

    // Mock response
    return res.json({
      sessionId,
      status: 'active',
      userId: 'test_user',
      createdAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Failed to get session:', error.message);
    return res.status(500).json({ error: 'Failed to get session' });
  }
});

/**
 * POST /api/session/reload-hotwords
 * Reload hotwords for active sessions
 */
router.post('/reload-hotwords', async (req: Request, res: Response) => {
  try {
    const { userId, hotwords } = req.body;

    if (!userId || !hotwords) {
      return res.status(400).json({ error: 'userId and hotwords are required' });
    }

    // Call TEN Agent HTTP API
    const response = await axios.post(`${TEN_AGENT_API_URL}/reload-hotwords`, {
      user_id: userId,
      hotwords
    });

    return res.json({ success: (response.data as any).success });
  } catch (error: any) {
    console.error('Failed to reload hotwords:', error.message);
    return res.status(500).json({ error: 'Failed to reload hotwords' });
  }
});

export default router;
