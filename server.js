var config = require('./config');
var azure = require('azure-storage');
var fs = require('fs');
var dir = require('node-dir');
var moment = require('moment');
var commandLineArgs = require("command-line-args");
 
var cli = commandLineArgs([
    { name: "pathtobackup", alias: "p", type: String },
    { name: "daystokeep", alias: "d", type: Number }
]);

var usage = cli.getUsage({
	title: "BackupBackup",
    description: "Uploads a directory of files to Azure. Optionally deletes old files (if daystokeep is specified)."
});
var options = cli.parse();

if(options.pathtobackup === undefined) {
	console.log(usage);
	process.exit(1);	
}

console.log("********** BackupBackup! **********");
console.log("Container: " + config.azureContainerName);
console.log("Storage Account: " + config.azureStorageAccount);
console.log();

//create a blob service set explicit credentials
var blobService = azure.createBlobService(config.azureStorageAccount, config.azureAccessKey);

var backupDirectory = options.pathtobackup;

var doDelete = false;
if(options.daystokeep !== undefined) {
	var  deleteThresholdDate = moment().subtract(Number(options.daystokeep), "days");
	doDelete = true;
	console.log("Will delete any files in source directory older than " + options.daystokeep + " days (" + deleteThresholdDate.format() + ")");
}

dir.files(backupDirectory, function(err, files) {
	if (err) throw err;

	//we have an array of files now, so now we'll iterate that array
	files.forEach(function(path) {
		// if older than 1 week delete (assume it's already gone to Azure)
		if(fs.stat(path, function(err, stats) {
			if (err) throw err;
			var dateLastModified = moment(stats.mtime)
			if(doDelete && (dateLastModified < deleteThresholdDate)) {
				console.log("Deleting old file [" + path + "]");
				fs.unlink(path);
			}
			else {
				UploadFileToAzure(path, backupDirectory);
			}
		}));
	})
});

function UploadFileToAzure(filename, backupDir) {

	// Remove the backup directory (preserving any subdirectories), and trailing slashes
	var filenameAzure = filename.replace(backupDir.replace("/", "\\"),"").replace(/^[\/\\]|[\/\\]$/g, '');
	
	blobService.doesBlobExist(config.azureContainerName, filenameAzure, function(error, result) {
		if (!error) {
			if (result) {
				console.log("File  [" + filenameAzure + "] already exists in directory...");
			} else {
				console.log("File does not exist, uploading to Azure [" + filename + "]");
				
				blobService.createBlockBlobFromLocalFile(config.azureContainerName, filenameAzure, filename, function(error, result, response){
					if(!error){
						console.log("File uploaded [" + filenameAzure + "]");
					}
					else {
						console.log("Uh oh! Failed to upload [" + filenameAzure + "] - result [" + error + "]");
					}
				});
				
			}
		}
	});
}
