"""
SQLite + FAISS Backend for PowerMem
替代OceanBase，实现记忆持久化和向量检索
"""
import sqlite3
import pickle
import os
from typing import List, Dict, Optional
import faiss
import numpy as np
from threading import Lock


class PowerMemSQLiteBackend:
    def __init__(self, db_path: str = "/root/VoxFlame-Agent/data/powermem.db"):
        self.db_path = db_path
        self.index_path = db_path.replace(".db", ".faiss_index")
        self.mapping_path = db_path.replace(".db", ".faiss_mapping.pkl")
        
        self.lock = Lock()
        self._init_database()
        self._load_faiss_index()
    
    def _init_database(self):
        """初始化SQLite数据库表"""
        # WAL模式提升并发性能
        conn = sqlite3.connect(self.db_path)
        conn.execute('PRAGMA journal_mode=WAL')
        conn.execute('PRAGMA synchronous=NORMAL')
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                text TEXT NOT NULL,
                embedding_dim INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata BLOB
            )
        ''')
        
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_user_id ON memories(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_session_id ON memories(session_id)')
        
        conn.commit()
        conn.close()
    
    def _load_faiss_index(self):
        """加载或创建FAISS向量索引"""
        if os.path.exists(self.index_path) and os.path.exists(self.mapping_path):
            self.faiss_index = faiss.read_index(self.index_path)
            with open(self.mapping_path, 'rb') as f:
                self.id_mapping = pickle.load(f)
            print(f"✅ Loaded FAISS index with {self.faiss_index.ntotal} vectors")
        else:
            # 创建新的FAISS索引（384维，DashScope text-embedding-v1）
            self.faiss_index = faiss.IndexFlatL2(384)
            self.id_mapping = {}  # {faiss_id: db_id}
            print("✅ Created new FAISS index")
    
    def _save_faiss_index(self):
        """持久化FAISS索引"""
        with self.lock:
            faiss.write_index(self.faiss_index, self.index_path)
            with open(self.mapping_path, 'wb') as f:
                pickle.dump(self.id_mapping, f)
    
    def store_memory(
        self,
        user_id: str,
        session_id: str,
        text: str,
        embedding: List[float],
        metadata: Optional[Dict] = None
    ) -> int:
        """
        存储记忆到SQLite + FAISS
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        metadata_blob = pickle.dumps(metadata) if metadata else None
        cursor.execute('''
            INSERT INTO memories (user_id, session_id, text, embedding_dim, metadata)
            VALUES (?, ?, ?, ?, ?)
        ''', (user_id, session_id, text, len(embedding), metadata_blob))
        
        memory_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        # 添加到FAISS索引
        with self.lock:
            embedding_np = np.array([embedding], dtype=np.float32)
            faiss_id = self.faiss_index.ntotal
            self.faiss_index.add(embedding_np)
            self.id_mapping[faiss_id] = memory_id
        
        return memory_id
    
    def search_memory(
        self,
        user_id: str,
        query_embedding: List[float],
        top_k: int = 5
    ) -> List[Dict]:
        """向量检索记忆"""
        with self.lock:
            query_np = np.array([query_embedding], dtype=np.float32)
            distances, indices = self.faiss_index.search(query_np, min(top_k * 2, self.faiss_index.ntotal))
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        results = []
        for i, faiss_id in enumerate(indices[0]):
            if faiss_id == -1:
                continue
            
            db_id = self.id_mapping.get(int(faiss_id))
            if db_id is None:
                continue
            
            cursor.execute('''
                SELECT text, session_id FROM memories
                WHERE id = ? AND user_id = ?
            ''', (db_id, user_id))
            
            row = cursor.fetchone()
            if row:
                results.append({
                    "text": row[0],
                    "session_id": row[1],
                    "similarity": float(1 / (1 + distances[0][i]))
                })
            
            if len(results) >= top_k:
                break
        
        conn.close()
        return results
    
    def delete_session(self, session_id: str):
        """删除会话"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('DELETE FROM memories WHERE session_id = ?', (session_id,))
        conn.commit()
        conn.close()
    
    def get_user_stats(self, user_id: str) -> Dict:
        """获取用户统计"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('SELECT COUNT(*) FROM memories WHERE user_id = ?', (user_id,))
        total_memories = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(DISTINCT session_id) FROM memories WHERE user_id = ?', (user_id,))
        total_sessions = cursor.fetchone()[0]
        
        conn.close()
        
        return {
            "total_memories": total_memories,
            "total_sessions": total_sessions,
            "faiss_index_size": self.faiss_index.ntotal
        }
    
    def close(self):
        """关闭时持久化"""
        self._save_faiss_index()
        print("✅ FAISS index saved")


if __name__ == "__main__":
    backend = PowerMemSQLiteBackend()
    
    # 测试插入
    test_embedding = np.random.rand(384).tolist()
    memory_id = backend.store_memory(
        user_id="test_user",
        session_id="session_001",
        text="今天天气真好",
        embedding=test_embedding,
        metadata={"sentiment": "positive"}
    )
    print(f"✅ Stored memory ID: {memory_id}")
    
    # 测试检索
    results = backend.search_memory("test_user", test_embedding, top_k=3)
    print(f"✅ Search results: {len(results)} items")
    
    # 统计
    stats = backend.get_user_stats("test_user")
    print(f"✅ Stats: {stats}")
    
    # 关闭
    backend.close()
