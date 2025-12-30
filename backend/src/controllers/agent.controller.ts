/**
 * Agent Controller
 * 
 * 接收 TEN Agent Webhook 请求，处理会话管理、用户配置和工具执行。
 * 作为 TEN Framework 和 agent-sdk 业务层之间的桥梁。
 */

import { Request, Response, Router } from 'express'

// 模拟的用户数据存储 (生产环境应使用数据库)
const userProfiles: Map<string, UserProfile> = new Map()
const sessionLogs: Map<string, SessionLog[]> = new Map()
const toolLogs: Map<string, ToolLog[]> = new Map()

// 类型定义
interface UserProfile {
  userId: string
  name: string
  language: string
  preferences: {
    voiceId: string
    speechRate: number
    hotwords: string[]
  }
  contacts: Contact[]
  devices: SmartDevice[]
  emergencyContacts: Contact[]
  createdAt: number
  updatedAt: number
}

interface Contact {
  name: string
  phone: string
  relationship: string
}

interface SmartDevice {
  id: string
  name: string
  type: string
  location: string
  status: string
}

interface SessionLog {
  sessionId: string
  userId: string
  source: 'asr' | 'llm'
  text: string
  timestamp: number
}

interface ToolLog {
  sessionId: string
  userId: string
  toolName: string
  arguments: Record<string, any>
  result: Record<string, any>
  success: boolean
  timestamp: number
}

// 初始化示例数据
function initSampleData() {
  const sampleUser: UserProfile = {
    userId: 'user_001',
    name: '张爷爷',
    language: 'zh-CN',
    preferences: {
      voiceId: 'longxiaochun',
      speechRate: 0.9,
      hotwords: ['儿子', '女儿', '老伴', '医生', '吃药', '开灯', '关灯', '空调']
    },
    contacts: [
      { name: '儿子', phone: '13800138001', relationship: 'son' },
      { name: '女儿', phone: '13800138002', relationship: 'daughter' },
      { name: '老伴', phone: '13800138003', relationship: 'spouse' },
      { name: '医生', phone: '13800138004', relationship: 'doctor' }
    ],
    devices: [
      { id: 'light_bedroom', name: '卧室灯', type: 'light', location: '卧室', status: 'off' },
      { id: 'light_living', name: '客厅灯', type: 'light', location: '客厅', status: 'on' },
      { id: 'ac_bedroom', name: '卧室空调', type: 'ac', location: '卧室', status: 'off' },
      { id: 'tv_living', name: '客厅电视', type: 'tv', location: '客厅', status: 'off' }
    ],
    emergencyContacts: [
      { name: '儿子', phone: '13800138001', relationship: 'son' },
      { name: '120急救', phone: '120', relationship: 'emergency' }
    ],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  userProfiles.set('user_001', sampleUser)
}

initSampleData()

export class AgentController {
  /**
   * 获取用户配置
   * GET /api/agent/profile/:userId
   */
  static async getUserProfile(req: Request, res: Response) {
    try {
      const { userId } = req.params
      
      let profile = userProfiles.get(userId)
      
      if (!profile) {
        // 返回默认配置
        profile = {
          userId,
          name: '用户',
          language: 'zh-CN',
          preferences: {
            voiceId: 'longxiaochun',
            speechRate: 1.0,
            hotwords: []
          },
          contacts: [],
          devices: [],
          emergencyContacts: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
      
      res.json(profile)
    } catch (error) {
      console.error('Error getting user profile:', error)
      res.status(500).json({ error: 'Failed to get user profile' })
    }
  }
  
  /**
   * 更新用户配置
   * PUT /api/agent/profile/:userId
   */
  static async updateUserProfile(req: Request, res: Response) {
    try {
      const { userId } = req.params
      const updates = req.body
      
      let profile = userProfiles.get(userId)
      
      if (!profile) {
        profile = {
          userId,
          name: '用户',
          language: 'zh-CN',
          preferences: {
            voiceId: 'longxiaochun',
            speechRate: 1.0,
            hotwords: []
          },
          contacts: [],
          devices: [],
          emergencyContacts: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
      
      // 合并更新
      const updatedProfile: UserProfile = {
        ...profile,
        ...updates,
        updatedAt: Date.now()
      }
      
      userProfiles.set(userId, updatedProfile)
      res.json(profile)
    } catch (error) {
      console.error('Error updating user profile:', error)
      res.status(500).json({ error: 'Failed to update user profile' })
    }
  }
  
  /**
   * 记录会话日志
   * POST /api/agent/session/log
   */
  static async logSession(req: Request, res: Response) {
    try {
      const { user_id, session_id, source, text, timestamp } = req.body
      
      const log: SessionLog = {
        sessionId: session_id,
        userId: user_id,
        source,
        text,
        timestamp: timestamp || Date.now()
      }
      
      // 存储日志
      const key = `${user_id}_${session_id}`
      let logs = sessionLogs.get(key) || []
      logs.push(log)
      
      // 限制每个会话的日志数量
      if (logs.length > 100) {
        logs = logs.slice(-100)
      }
      
      sessionLogs.set(key, logs)
      
      console.log(`[Session Log] ${source}: ${text.substring(0, 50)}...`)
      
      res.json({ success: true })
    } catch (error) {
      console.error('Error logging session:', error)
      res.status(500).json({ error: 'Failed to log session' })
    }
  }
  
  /**
   * 获取会话历史
   * GET /api/agent/session/:userId/:sessionId
   */
  static async getSessionHistory(req: Request, res: Response) {
    try {
      const { userId, sessionId } = req.params
      const key = `${userId}_${sessionId}`
      
      const logs = sessionLogs.get(key) || []
      res.json(logs)
    } catch (error) {
      console.error('Error getting session history:', error)
      res.status(500).json({ error: 'Failed to get session history' })
    }
  }
  
  /**
   * 记录工具执行日志
   * POST /api/agent/tool/log
   */
  static async logToolExecution(req: Request, res: Response) {
    try {
      const { user_id, session_id, tool_name, result, success, timestamp } = req.body
      
      const log: ToolLog = {
        sessionId: session_id,
        userId: user_id,
        toolName: tool_name,
        arguments: {},
        result,
        success,
        timestamp: timestamp || Date.now()
      }
      
      // 存储日志
      const key = user_id
      let logs = toolLogs.get(key) || []
      logs.push(log)
      
      // 限制日志数量
      if (logs.length > 50) {
        logs = logs.slice(-50)
      }
      
      toolLogs.set(key, logs)
      
      console.log(`[Tool Log] ${tool_name}: ${success ? 'success' : 'failed'}`)
      
      res.json({ success: true })
    } catch (error) {
      console.error('Error logging tool execution:', error)
      res.status(500).json({ error: 'Failed to log tool execution' })
    }
  }
  
  /**
   * 执行工具
   * POST /api/agent/tool/execute
   */
  static async executeTool(req: Request, res: Response) {
    try {
      const { user_id, session_id, tool_name, arguments: args } = req.body
      
      let result: Record<string, any>
      
      switch (tool_name) {
        case 'make_phone_call':
          result = await AgentController.executePhoneCall(user_id, args)
          break
        case 'control_smart_device':
          result = await AgentController.executeDeviceControl(user_id, args)
          break
        case 'send_emergency_alert':
          result = await AgentController.executeEmergencyAlert(user_id, args)
          break
        case 'set_reminder':
          result = await AgentController.executeSetReminder(user_id, args)
          break
        default:
          result = { success: false, error: `Unknown tool: ${tool_name}` }
      }
      
      // 记录工具执行
      const log: ToolLog = {
        sessionId: session_id,
        userId: user_id,
        toolName: tool_name,
        arguments: args,
        result,
        success: result.success,
        timestamp: Date.now()
      }
      
      const key = user_id
      let logs = toolLogs.get(key) || []
      logs.push(log)
      toolLogs.set(key, logs)
      
      res.json(result)
    } catch (error) {
      console.error('Error executing tool:', error)
      res.status(500).json({ success: false, error: 'Failed to execute tool' })
    }
  }
  
  /**
   * 执行拨打电话
   */
  private static async executePhoneCall(userId: string, args: any): Promise<Record<string, any>> {
    const { contact_name, phone_number } = args
    const profile = userProfiles.get(userId)
    
    // 查找联系人
    let phone = phone_number
    if (!phone && profile) {
      const contact = profile.contacts.find(c => c.name === contact_name)
      if (contact) {
        phone = contact.phone
      }
    }
    
    if (!phone) {
      return {
        success: false,
        message: `找不到${contact_name}的电话号码`,
        needConfirmation: true
      }
    }
    
    // 模拟拨打电话
    console.log(`[Tool] 拨打电话: ${contact_name} (${phone})`)
    
    return {
      success: true,
      message: `正在拨打${contact_name}的电话`,
      phone,
      action: 'call_initiated'
    }
  }
  
  /**
   * 执行智能设备控制
   */
  private static async executeDeviceControl(userId: string, args: any): Promise<Record<string, any>> {
    const { device, action, location, value } = args
    const profile = userProfiles.get(userId)
    
    if (!profile) {
      return { success: false, message: '用户配置未找到' }
    }
    
    // 查找设备
    const targetDevice = profile.devices.find(d => 
      d.name.includes(device) || 
      (d.location === location && d.type === device)
    )
    
    if (!targetDevice) {
      return {
        success: false,
        message: `找不到${location || ''}${device}设备`
      }
    }
    
    // 执行操作
    const actionMap: Record<string, string> = {
      'open': 'on',
      'close': 'off',
      'increase': 'increased',
      'decrease': 'decreased'
    }
    
    targetDevice.status = actionMap[action] || action
    
    console.log(`[Tool] 控制设备: ${targetDevice.name} -> ${action}`)
    
    return {
      success: true,
      message: `已${action === 'open' ? '打开' : action === 'close' ? '关闭' : action}${targetDevice.name}`,
      device: targetDevice.name,
      newStatus: targetDevice.status
    }
  }
  
  /**
   * 执行紧急求助
   */
  private static async executeEmergencyAlert(userId: string, args: any): Promise<Record<string, any>> {
    const { emergency_type, message } = args
    const profile = userProfiles.get(userId)
    
    const emergencyContacts = profile?.emergencyContacts || []
    
    console.log(`[Tool] 紧急求助: ${emergency_type} - ${message || '无附加信息'}`)
    console.log(`[Tool] 通知联系人: ${emergencyContacts.map(c => c.name).join(', ')}`)
    
    // 模拟发送紧急通知
    return {
      success: true,
      message: '紧急求助已发送，家人会尽快联系您',
      alertType: emergency_type,
      notifiedContacts: emergencyContacts.map(c => c.name)
    }
  }
  
  /**
   * 执行设置提醒
   */
  private static async executeSetReminder(userId: string, args: any): Promise<Record<string, any>> {
    const { content, time } = args
    
    console.log(`[Tool] 设置提醒: ${content} at ${time || '稍后'}`)
    
    return {
      success: true,
      message: `好的，我会${time ? `在${time}` : '稍后'}提醒您${content}`,
      reminderContent: content,
      reminderTime: time
    }
  }
  
  /**
   * 获取热词列表 (供ASR使用)
   * GET /api/agent/hotwords/:userId
   */
  static async getHotwords(req: Request, res: Response) {
    try {
      const { userId } = req.params
      const profile = userProfiles.get(userId)
      
      // 组合用户热词
      const hotwords: string[] = []
      
      if (profile) {
        // 添加用户自定义热词
        hotwords.push(...profile.preferences.hotwords)
        
        // 添加联系人名称
        profile.contacts.forEach(c => hotwords.push(c.name))
        
        // 添加设备名称
        profile.devices.forEach(d => {
          hotwords.push(d.name)
          hotwords.push(d.location)
        })
      }
      
      // 去重
      const uniqueHotwords = [...new Set(hotwords)]
      
      res.json({
        hotwords: uniqueHotwords,
        count: uniqueHotwords.length
      })
    } catch (error) {
      console.error('Error getting hotwords:', error)
      res.status(500).json({ error: 'Failed to get hotwords' })
    }
  }
}

// 创建路由器
export const agentRouter = Router()

// 用户配置
agentRouter.get('/profile/:userId', AgentController.getUserProfile)
agentRouter.put('/profile/:userId', AgentController.updateUserProfile)

// 会话管理
agentRouter.post('/session/log', AgentController.logSession)
agentRouter.get('/session/:userId/:sessionId', AgentController.getSessionHistory)

// 工具执行
agentRouter.post('/tool/log', AgentController.logToolExecution)
agentRouter.post('/tool/execute', AgentController.executeTool)

// 热词
agentRouter.get('/hotwords/:userId', AgentController.getHotwords)
