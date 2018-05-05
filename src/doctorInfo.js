const settings = require('electron-settings');
const poster = require('./utils/poster.js');
const remote = require('electron').remote;
const BrowserWindow = remote.BrowserWindow;
const ipcMain = remote.ipcMain;
const url = require('url');
const path = require('path');

var doctors = [];
var postobj = { 
    authCode: settings.get('authCode') 
};
var patientAmt = 0;
var doctorAmt = 0;
var sectionBtn = null;
var viewing = '';
var patients = [];
var curPatient = null;

function Bind ()
{
    //console.log('BindDoctorInfo');
    sectionBtn = document.getElementById('button-doctor-info');
    sectionBtn.addEventListener('click', GatherDoctors);

    document.getElementById('doctor-info-back-btn').addEventListener('click', ReturnToListBtn);
    document.getElementById('doctor-info-remove-doc-btn').addEventListener('click', RemoveDoctorPrompt);
}

function GatherDoctors ()
{
    if (viewing != '')
        ReturnToList('GatherDoctors');

    patientAmt = 0;
    doctorAmt = 0;

    poster.post(postobj, '/fetch/doctors', function (resObj) {
        doctors = [];

        doctors[''] = {
            familyName: '',
            givenName: '',
            patientCount: 0
        };

        Array.prototype.forEach.call(resObj, function (d) {
            doctorAmt++;
            doctors[d.email] = {
                familyName: d.familyName,
                givenName: d.givenName,
                patientCount: 0
            };
        });
        
        ReadPatients();
    });
}

function ReadPatients ()
{
    poster.post(postobj, '/fetch/patientMeta', function (resObj) {
        for (var i = 0; i < resObj.meta.length; i++)
        {
            doctors[resObj.meta[i].doctorEmail].patientCount++;
            if (resObj.meta[i].doctorEmail != '')
                patientAmt++;
        }
        MakeTable();
    });
}

function MakeTable ()
{
    var avgs = document.getElementById('doctor-info-avgs');
    avgs.innerHTML = 'Number of Doctors: ' + doctorAmt + 
                     '<br>Number of Patients: ' + patientAmt +
                     '<br>Average Patients Per Doctor: ' + (patientAmt / doctorAmt);

    var area = document.getElementById('doctor-info-table-area');
    var table = document.createElement('table');
    table.id = 'doctor-info-table';
    area.innerHTML = '';
    area.appendChild(table);

    var inner = '<tr><th>Family Name</th><th>Given Name</th><th>Email</th><th>Patient Amount</th><th></th></tr>';
    for (var d in doctors) 
    {
        if (d == '')
            continue;
        var doc = {
            familyName: doctors[d].familyName,
            givenName: doctors[d].givenName,
            email: d
        };
        inner += '<tr><td>' + doctors[d].familyName 
               + '</td><td>' + doctors[d].givenName
               + '</td><td>' + d 
               + '</td><td>' + doctors[d].patientCount
               + '</td><td><button class="doctor-info-details-btn" data-info=' + JSON.stringify(doc) + '>Details</button>'
               + '</td></tr>';
    };

    table = document.getElementById('doctor-info-table');
    table.innerHTML = inner;

    var btns = document.getElementsByClassName('doctor-info-details-btn');
    for (var i = 0; i < btns.length; i++)
    {
        btns[i].addEventListener('click', (event) => {
            //console.log(event.srcElement.dataset.info);
            var data = JSON.parse(event.srcElement.dataset.info);
            document.getElementById('doctor-info-list-view').classList.remove('is-shown');
            SetupDetailedView(data);
            document.getElementById('doctor-info-doctor-view').classList.add('is-shown');
        });
    }
}

function ReturnToListBtn () { ReturnToList('Button'); }
function ReturnToList (source)
{
    viewing = '';
    if (source != 'GatherDoctors')
        GatherDoctors();
    document.getElementById('doctor-info-doctor-view').classList.remove('is-shown');
    document.getElementById('doctor-info-list-view').classList.add('is-shown');
}

function SetupDetailedView (doctor)
{
    patients = [];
    viewing = doctor;
    var area = document.getElementById('doctor-info-patient-area');
    var table = document.createElement('table');
    table.id = 'doctor-info-patient-table';
    area.innerHTML = '';
    area.appendChild(table);

    var inner = '<tr><th>ID</th><th>Family Name</th><th>Given Name</th><th>Email</th><th></th><th></th></tr>';

    poster.post(postobj, '/fetch/patientMeta', function (resObj) {
        for (var i = 0; i < resObj.meta.length; i++)
        {
            var pat = resObj.meta[i];
            if (pat.doctorEmail != viewing.email)
                continue;
            patients.push(pat);
            inner += '<tr><td>' + pat.id
                   + '</td><td>' + pat.familyName
                   + '</td><td>' + pat.givenName
                   + '</td><td>' + pat.email
                   + '</td><td><button class="doctor-info-patient-transfer-btn" data-pat=' + JSON.stringify(pat) + '>Transfer</button>'
                   + '</td><td><button class="doctor-info-patient-retire-btn" data-pat=' + JSON.stringify(pat) + '>Retire</button>'
                   + '</td></tr>';
        }

        inner += '<tr><td colspan="6"><button id="doctor-info-patient-insert-btn">Insert</button></td></tr>';

        table = document.getElementById('doctor-info-patient-table');
        table.innerHTML = inner;

        var btns = document.getElementsByClassName('doctor-info-patient-transfer-btn');
        for (var i = 0; i < btns.length; i++)
            btns[i].addEventListener('click', TransferPrompt);
        
        btns = document.getElementsByClassName('doctor-info-patient-retire-btn');
        for (var i = 0; i < btns.length; i++)
            btns[i].addEventListener('click', RetirePatientPrompt);
        
        document.getElementById('doctor-info-patient-insert-btn').addEventListener('click', InsertPatientPrompt);
    });
}

function RemoveDoctorPrompt ()
{
    if (viewing == null)
        return;
    if (viewing.email == settings.get('email'))
    {
        console.log('Cannot Remove Yourself');
        return;
    }
    if (patients.length != 0)
    {
        console.log('Please Transfer All Patients Before Removing');
        return;
    }
    
    var win = new BrowserWindow({
        width: 600,
        height: 400,
        title: 'Remove Doctor'
    });
    win.loadURL(url.format({
        pathname: path.join(__dirname, '/../view/popups/removeDoctor.html'),
        protocol: 'file:',
        slashes: true
    }));
    win.show();
    win.on('close', () => { win = null; });
}

function TransferPrompt (event)
{
    if (viewing == null)
        return;

    curPatient = JSON.parse(event.srcElement.dataset.pat);

    var win = new BrowserWindow({
        width: 600,
        height: 400,
        title: 'Transfer Patient'
    });
    win.loadURL(url.format({
        pathname: path.join(__dirname, '/../view/popups/transferPatient.html'),
        protocol: 'file:',
        slashes: true
    }));
    win.show();
    win.on('close', () => { win = null; });
}

function RetirePatientPrompt (event)
{
    if (viewing == null)
        return;

    curPatient = JSON.parse(event.srcElement.dataset.pat);

    var win = new BrowserWindow({
        width: 600,
        height: 400,
        title: 'Retire Patient'
    });
    win.loadURL(url.format({
        pathname: path.join(__dirname, '/../view/popups/retirePatient.html'),
        protocol: 'file:',
        slashes: true
    }));
    win.show();
    win.on('close', () => { win = null; });
}

function InsertPatientPrompt (event)
{
    if (viewing == null)
        return;

    var win = new BrowserWindow({
        width: 600,
        height: 400,
        title: 'Insert Patient'
    });
    win.loadURL(url.format({
        pathname: path.join(__dirname, '/../view/popups/insertPatient.html'),
        protocol: 'file:',
        slashes: true
    }));
    win.show();
    win.on('close', () => { win = null; });
}

ipcMain.on('ipc-doctor-info-curDoctor', (event, arg) => {
    if (arg == 'get')
        event.returnValue = viewing;
    else if (arg == 'change')
    {
        ReturnToListBtn();
        viewing = null;
        event.returnValue = null;
    }
    else
    {
        viewing = null;
        event.returnValue = null;
    }
});

ipcMain.on('ipc-doctor-info-curPatient', (event, arg) => {
    if (arg == 'get')
        event.returnValue = curPatient;
    else if (arg == 'change')
    {
        SetupDetailedView(viewing);
        curPatient = null;
        event.returnValue = null;
    }
    else
    {
        curPatient = null;
        event.returnValue = null;
    }
});

module.exports.Bind = Bind;