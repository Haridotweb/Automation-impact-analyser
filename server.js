const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Please upload CSV or Excel files.'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Helper function to analyze CSV file
function analyzeCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        if (results.length === 0) {
          resolve({ rows: 0, columns: 0, preview: [], columnNames: [] });
          return;
        }

        const columnNames = Object.keys(results[0]);
        const numericStats = calculateNumericStats(results, columnNames);

        resolve({
          rows: results.length,
          columns: columnNames.length,
          columnNames: columnNames,
          dataTypes: inferDataTypes(results, columnNames),
          numericStats: numericStats,
          preview: results.slice(0, 5)
        });
      })
      .on('error', reject);
  });
}

// Helper function to analyze Excel file
function analyzeExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const results = XLSX.utils.sheet_to_json(worksheet);

  if (results.length === 0) {
    return {
      rows: 0,
      columns: 0,
      preview: [],
      columnNames: []
    };
  }

  const columnNames = Object.keys(results[0]);
  const numericStats = calculateNumericStats(results, columnNames);

  return {
    rows: results.length,
    columns: columnNames.length,
    columnNames: columnNames,
    dataTypes: inferDataTypes(results, columnNames),
    numericStats: numericStats,
    preview: results.slice(0, 5)
  };
}

// Helper function to infer data types
function inferDataTypes(data, columns) {
  const dataTypes = {};
  columns.forEach(column => {
    const sampleValue = data[0]?.[column];
    if (sampleValue === undefined || sampleValue === null) {
      dataTypes[column] = 'unknown';
    } else if (!isNaN(parseFloat(sampleValue)) && isFinite(sampleValue)) {
      dataTypes[column] = 'number';
    } else if (typeof sampleValue === 'boolean' || sampleValue.toLowerCase() === 'true' || sampleValue.toLowerCase() === 'false') {
      dataTypes[column] = 'boolean';
    } else if (!isNaN(Date.parse(sampleValue))) {
      dataTypes[column] = 'date';
    } else {
      dataTypes[column] = 'string';
    }
  });
  return dataTypes;
}

// Helper function to calculate numeric statistics
function calculateNumericStats(data, columns) {
  const stats = {};
  
  columns.forEach(column => {
    const values = data.map(row => parseFloat(row[column])).filter(val => !isNaN(val));
    
    if (values.length > 0) {
      stats[column] = {
        count: values.length,
        mean: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        sum: values.reduce((a, b) => a + b, 0)
      };
      
      // Calculate percentiles
      const sorted = [...values].sort((a, b) => a - b);
      stats[column].median = sorted[Math.floor(sorted.length / 2)];
      stats[column].q1 = sorted[Math.floor(sorted.length * 0.25)];
      stats[column].q3 = sorted[Math.floor(sorted.length * 0.75)];
    }
  });
  
  return stats;
}

// Routes
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();

    let analysisResult;

    if (fileExt === '.csv') {
      analysisResult = await analyzeCSV(filePath);
    } else if (fileExt === '.xlsx' || fileExt === '.xls') {
      analysisResult = analyzeExcel(filePath);
    } else {
      // Clean up uploaded file
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Unsupported file format' });
    }

    res.json({
      message: 'File analyzed successfully',
      filename: req.file.originalname,
      ...analysisResult
    });

    // Clean up uploaded file after analysis
    setTimeout(() => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }, 5000);

  } catch (error) {
    console.error('Error analyzing file:', error);
    
    // Clean up uploaded file in case of error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      error: 'Failed to analyze file', 
      details: error.message 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Automation Impact Analyzer Backend is running',
    timestamp: new Date().toISOString()
  });
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
  }
  res.status(500).json({ error: error.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Automation Impact Analyzer Backend running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📤 Upload endpoint: http://localhost:${PORT}/upload`);
});

module.exports = app;