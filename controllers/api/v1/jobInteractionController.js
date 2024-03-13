const Job = require('../../../models/api/v1/Jobs');
const JobApplication = require('../../../models/api/v1/JobApplication');

// apply for job
const applyJob = async (req, res) => {
    try {
        const { jobId } = req.params;
        const userId = req.user.userId;

        // check if jobId is provided
        if (!jobId) {
            return res.status(400).json({ message: 'Job ID is required' });
        }

        // find job by ID
        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({ message: 'Job not found' });
        }

        // create new application
        const application = new JobApplication({
            job: jobId,
            user: userId,
            date: new Date(),
            status: 'pending'
        });

        // save job application
        await application.save();

        job.applications.push(application);
        await job.save();

        const populatedJob = await Job.findById(jobId).populate('applications');

        // NOTIFY BUSINESS OF APPLICATION DEPENDING ON NOTIFICATION PREFERENCE

        res.status(201).json({ message: 'Job application submitted successfully' , job: populatedJob});
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    applyJob,
};