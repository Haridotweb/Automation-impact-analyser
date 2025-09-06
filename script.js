document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('fileInput');
    const fileName = document.getElementById('fileName');
    const uploadForm = document.getElementById('uploadForm');
    const loading = document.getElementById('loading');
    const result = document.getElementById('result');
    const resultContent = document.getElementById('resultContent');
    const error = document.getElementById('error');
    const errorContent = document.getElementById('errorContent');
    const analyzeBtn = uploadForm.querySelector('button[type="submit"]');

    // Update file name display
    fileInput.addEventListener('change', function() {
        fileName.textContent = this.files[0] ? this.files[0].name : 'No file chosen';
    });

    // Handle form submission
    uploadForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const file = fileInput.files[0];
        if (!file) {
            showError('Please select a file first');
            return;
        }

        // Check file type
        if (!file.name.toLowerCase().endsWith('.csv') && 
            !file.name.toLowerCase().endsWith('.xlsx') &&
            !file.name.toLowerCase().endsWith('.xls')) {
            showError('Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
            return;
        }

        // Show loading, hide previous results/errors
        loading.classList.remove('hidden');
        result.classList.add('hidden');
        error.classList.add('hidden');
        analyzeBtn.disabled = true;

        try {
            const formData = new FormData();
            formData.append('file', file);

            console.log('Uploading file:', file.name);
            
            const response = await fetch('http://localhost:5000/upload', {
                method: 'POST',
                body: formData
            });

            console.log('Response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.details || `Server error: ${response.status}`);
            }

            const data = await response.json();
            console.log('Analysis successful:', data);
            displayResults(data);
            
        } catch (err) {
            console.error('Upload error:', err);
            showError(err.message);
        } finally {
            loading.classList.add('hidden');
            analyzeBtn.disabled = false;
        }
    });

    function displayResults(data) {
        resultContent.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${data.rows}</div>
                    <div class="stat-label">Total Rows</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${data.columns}</div>
                    <div class="stat-label">Total Columns</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${data.filename}</div>
                    <div class="stat-label">File Name</div>
                </div>
            </div>

            <div class="result-item">
                <h3>Column Information</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Column Name</th>
                            <th>Data Type</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(data.dataTypes || data.data_types || {}).map(([col, type]) => `
                            <tr>
                                <td>${col}</td>
                                <td>${type}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            ${data.preview && data.preview.length > 0 ? `
            <div class="result-item">
                <h3>Data Preview (First 5 Rows)</h3>
                <table>
                    <thead>
                        <tr>
                            ${data.columnNames.map(col => `<th>${col}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.preview.map(row => `
                            <tr>
                                ${data.columnNames.map(col => `<td>${row[col] !== undefined ? row[col] : ''}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ` : ''}

            ${data.numericStats && Object.keys(data.numericStats).length > 0 ? `
            <div class="result-item">
                <h3>Numeric Statistics</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Statistic</th>
                            ${Object.keys(data.numericStats).map(col => `<th>${col}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${['count', 'mean', 'min', 'max', 'median', 'q1', 'q3', 'sum'].map(stat => `
                            <tr>
                                <td><strong>${stat}</strong></td>
                                ${Object.keys(data.numericStats).map(col => `
                                    <td>${data.numericStats[col][stat] !== undefined ? 
                                        (typeof data.numericStats[col][stat] === 'number' ? 
                                         data.numericStats[col][stat].toFixed(2) : 
                                         data.numericStats[col][stat]) : 
                                        '-'}</td>
                                `).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ` : ''}
        `;

        result.classList.remove('hidden');
    }

    function showError(message) {
        errorContent.innerHTML = `
            <p><strong>Error:</strong> ${message}</p>
            <p>Please check:</p>
            <ul>
                <li>Backend server is running on http://localhost:5000</li>
                <li>File is not too large (max 10MB)</li>
                <li>File is in CSV or Excel format</li>
            </ul>
            <p>Check browser console (F12) for more details.</p>
        `;
        error.classList.remove('hidden');
    }

    // Test backend connection on page load
    async function testBackendConnection() {
        try {
            const response = await fetch('http://localhost:5000/health');
            if (response.ok) {
                console.log('Backend connection successful');
            } else {
                console.warn('Backend health check failed');
            }
        } catch (error) {
            console.error('Cannot connect to backend:', error);
        }
    }

    // Test connection when page loads
    testBackendConnection();
});