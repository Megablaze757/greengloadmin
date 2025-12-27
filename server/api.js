const express = require('express');
const cors = require('cors');
const { supabase } = require('./supabase');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/admin', express.static('admin'));

// Create tables if they don't exist
async function initializeDatabase() {
    const { error } = await supabase.from('availability').select('*').limit(1);
    
    if (error && error.message.includes('does not exist')) {
        console.log('Creating database tables...');
        // In a real implementation, you would run SQL to create tables
        // For now, we'll handle it in the code
    }
}

// API Routes

// Get all availability
app.get('/api/availability', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('availability')
            .select('*')
            .order('date', { ascending: true });
        
        if (error) throw error;
        
        // Transform data for frontend
        const days = {};
        let nextAvailable = null;
        
        data.forEach(day => {
            days[day.date] = {
                status: day.status,
                message: day.message,
                timeSlots: day.time_slots
            };
            
            // Find next available slot
            if (!nextAvailable && day.status === 'available' && new Date(day.date) >= new Date()) {
                nextAvailable = {
                    date: day.date,
                    timeSlots: day.time_slots
                };
            }
        });
        
        res.json({
            days,
            nextAvailable,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching availability:', error);
        res.status(500).json({ error: 'Failed to fetch availability' });
    }
});

// Get availability for specific date
app.get('/api/availability/:date', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('availability')
            .select('*')
            .eq('date', req.params.date)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        
        if (!data) {
            return res.json({
                date: req.params.date,
                status: 'available',
                message: null,
                timeSlots: []
            });
        }
        
        res.json({
            date: data.date,
            status: data.status,
            message: data.message,
            timeSlots: data.time_slots || []
        });
    } catch (error) {
        console.error('Error fetching date:', error);
        res.status(500).json({ error: 'Failed to fetch date' });
    }
});

// Save/update availability
app.post('/api/availability', async (req, res) => {
    try {
        const { date, status, message, timeSlots } = req.body;
        
        const { data, error } = await supabase
            .from('availability')
            .upsert({
                date,
                status,
                message,
                time_slots: timeSlots
            }, {
                onConflict: 'date'
            });
        
        if (error) throw error;
        
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error saving availability:', error);
        res.status(500).json({ error: 'Failed to save availability' });
    }
});

// Delete availability for date
app.delete('/api/availability/:date', async (req, res) => {
    try {
        const { error } = await supabase
            .from('availability')
            .delete()
            .eq('date', req.params.date);
        
        if (error) throw error;
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting availability:', error);
        res.status(500).json({ error: 'Failed to delete availability' });
    }
});

// Get API status
app.get('/api/status', async (req, res) => {
    try {
        const { error } = await supabase.from('availability').select('*').limit(1);
        
        if (error) {
            // Check if table doesn't exist
            if (error.message.includes('does not exist')) {
                // Create table
                // Note: In production, you would use migrations
                // This is a simplified example
                console.log('Table does not exist, would create it here');
            }
            throw error;
        }
        
        res.json({ status: 'connected' });
    } catch (error) {
        console.error('Database connection error:', error);
        res.status(500).json({ 
            status: 'disconnected', 
            error: error.message 
        });
    }
});

// Serve main site
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/../public/index.html');
});

// Serve admin panel
app.get('/admin', (req, res) => {
    res.sendFile(__dirname + '/../admin/index.html');
});

// Start server
app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
    
    try {
        await initializeDatabase();
        console.log('Database initialized');
    } catch (error) {
        console.error('Database initialization error:', error);
    }
});
