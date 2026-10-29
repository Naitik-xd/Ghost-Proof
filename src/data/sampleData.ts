export interface FactSample {
  id: string;
  title: string;
  badge: string;
  description: string;
  text: string;
}

export const FACT_SAMPLES: FactSample[] = [
  {
    id: 'ai-hallucination',
    title: 'AI Historical & Scientific Hallucinations',
    badge: 'High Contradictions',
    description: 'A paragraph containing common synthetic AI inaccuracies and historical fabrications.',
    text: `The Apollo 11 moon landing occurred on July 20, 1969, carrying astronauts Neil Armstrong and Buzz Aldrin to the lunar surface. Thomas Edison invented radar technology in 1903 during his early acoustic telegraph experiments in Menlo Park. The Great Wall of China is easily visible from the Moon with the naked human eye. Water reaches its maximum density at approximately 4 degrees Celsius before expanding as it freezes into ice.`,
  },
  {
    id: 'space-physics',
    title: 'Space & Modern Astrophysics Claims',
    badge: 'Supported Evidence',
    description: 'Astronomical assertions concerning the James Webb Space Telescope and fundamental physics.',
    text: `The James Webb Space Telescope orbits the Sun at the second Lagrange point (L2), roughly 1.5 million kilometers from Earth. The speed of light in a true vacuum is defined as exactly 299,792,458 meters per second. Mars has an atmosphere consisting predominantly of carbon dioxide, with atmospheric surface pressure less than 1 percent of Earth's. Voyager 1 became the first human-made spacecraft to cross the heliopause into interstellar space in August 2012.`,
  },
  {
    id: 'health-nuance',
    title: 'Medical & Biological Nuances',
    badge: 'Mixed Evidence',
    description: 'Nuanced claims with conflicting interpretations regarding antiviral treatments and vitamins.',
    text: `Antibiotics are standard, effective medical treatments for acute viral influenza infections. Taking high supplemental doses of Vitamin C has been conclusively shown to completely prevent any infection by the common cold virus. Type 1 diabetes is characterized by an autoimmune destruction of insulin-producing beta cells in the pancreas. Regular aerobic cardiovascular exercise correlates strongly with reduced all-cause cardiovascular mortality.`,
  },
];

export interface CodeSample {
  id: string;
  title: string;
  badge: string;
  description: string;
  files: Array<{ path: string; content: string }>;
}

export const CODE_SAMPLES: CodeSample[] = [
  {
    id: 'express-auth-vuln',
    title: 'Express Auth API (Secrets & SQL Injection)',
    badge: 'Critical Risks',
    description: 'A mock Node.js authentication module with hardcoded credentials and string-interpolated database queries.',
    files: [
      {
        path: 'src/config/auth.js',
        content: `// Authentication configuration
const JWT_SECRET = "sk-live-939a8fbc83d9418290e821a8c9b"; // Temporary test secret
const MONGO_URI = "mongodb+srv://admin:P@ssword2024!@cluster0.prod.mongodb.net/users";

module.exports = {
  JWT_SECRET,
  MONGO_URI,
  TOKEN_EXPIRY: "7d"
};`,
      },
      {
        path: 'src/routes/login.js',
        content: `const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/auth');

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  // Vulnerability: Direct SQL string interpolation allows authentication bypass
  const query = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'";
  
  try {
    const result = await db.rawQuery(query);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);
      return res.json({ token, user });
    }
    return res.status(401).json({ error: "Invalid credentials" });
  } catch (err) {
    // Leaks raw database error details to client
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
});

module.exports = router;`,
      },
      {
        path: 'src/db.js',
        content: `const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://dbuser:supersecretpass@localhost:5432/maindb"
});

module.exports = {
  rawQuery: (sql) => pool.query(sql)
};`,
      },
    ],
  },
  {
    id: 'python-eval-vuln',
    title: 'Python Storage Worker (Command Injection & AWS Key)',
    badge: 'Critical Security',
    description: 'Python service with unvalidated file path concatenation, dangerous eval execution, and exposed AWS key.',
    files: [
      {
        path: 'services/worker.py',
        content: `import os
import subprocess

AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE"
AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"

def process_user_report(report_id, command_args):
    # Dangerous: executing raw shell commands with user supplied arguments
    cmd = f"generate-report --id {report_id} {command_args}"
    output = subprocess.check_output(cmd, shell=True)
    return output

def evaluate_formula(expression_str):
    # Critical: eval on arbitrary user expression enables remote code execution
    result = eval(expression_str)
    return result
`,
      },
      {
        path: 'services/storage.py',
        content: `import os

def read_tenant_file(tenant_id, filename):
    # Path traversal vulnerability: no check against "../"
    base_dir = f"/var/data/{tenant_id}/"
    target_path = os.path.join(base_dir, filename)
    
    with open(target_path, 'r') as f:
        return f.read()
`,
      },
    ],
  },
  {
    id: 'clean-ts-service',
    title: 'TypeScript Data Sanitizer (Clean Baseline)',
    badge: 'Clean / Low Risk',
    description: 'A well-structured validation module with parameterized inputs and environment-based secrets.',
    files: [
      {
        path: 'src/utils/sanitize.ts',
        content: `export function sanitizeInput(raw: string): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[&<>"']/g, (match) => {
      const escapeMap: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;'
      };
      return escapeMap[match] || match;
    })
    .trim();
}

export function validateSafeUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}`,
      },
    ],
  },
];
