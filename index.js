const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const XLSX = require('xlsx');

const app = express();
const port = process.env.PORT || 3000;

// Configura EJS come view engine e i file statici
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

// Route per la root "/" che reindirizza a "/task-card"
app.get('/', (req, res) => {
  res.redirect('/task-card');
});

// Variabili globali per memorizzare la selezione
let selectedAirplane = null; // Il foglio (database) selezionato
let taskCardIds = [];        // Array degli ID delle task card (max 10)

/**
 * Route: GET /task-card
 * Mostra la pagina per inserire fino a 10 task card e scegliere il database (foglio aereo)
 */
app.get('/task-card', (req, res) => {
  res.render('task-card', {
    airplanes: ["A220", "A320", "A330", "A340", "A350", "A330NEO", "B777", "B737"],
    taskCardIds: taskCardIds
  });
});

/**
 * Route: POST /task-card
 * Riceve il form contenente il nome dell’aereo e le task card inserite.
 */
app.post('/task-card', (req, res) => {
  // Salva il foglio (aereo) selezionato
  selectedAirplane = req.body.airplane;

  // Ottieni i task card; se viene inviato un solo valore, convertilo in array
  let tasks = req.body.taskCard;
  if (!tasks) {
    tasks = [];
  } else if (!Array.isArray(tasks)) {
    tasks = [tasks];
  }
  // Filtra le stringhe vuote e limita a 10 task card
  taskCardIds = tasks.filter(tc => tc.trim() !== "").slice(0, 10);

  // Reindirizza alla pagina QUOTAZIONE
  res.redirect('/quotazione');
});

/**
 * Route: GET /quotazione
 * Carica il foglio Excel corrispondente al database selezionato,
 * ricerca le task card e visualizza i dati: description, hour, work area e Special.
 * Calcola il totale delle hour.
 */
app.get('/quotazione', (req, res) => {
  if (!selectedAirplane || taskCardIds.length === 0) {
    return res.redirect('/task-card');
  }

  // Legge il file Excel (assicurati che "airplanes.xlsx" sia nella root)
  let workbook;
  try {
    workbook = XLSX.readFile(path.join(__dirname, 'airplanes.xlsx'));
  } catch (err) {
    console.error("Errore nella lettura del file Excel:", err);
    return res.status(500).send("Errore nella lettura del file Excel.");
  }

  // Seleziona il foglio in base all'aereo scelto
  const sheetName = selectedAirplane;
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    return res.status(404).send("Foglio per l'aereo selezionato non trovato.");
  }

  // Converte il foglio in un array di oggetti
  const sheetData = XLSX.utils.sheet_to_json(worksheet);

  // Cerca ogni task card usando un confronto case-insensitive
  let results = [];
  taskCardIds.forEach(id => {
    const searchId = id.trim().toLowerCase();
    const row = sheetData.find(item => 
      item.TaskNo && item.TaskNo.toString().trim().toLowerCase() === searchId
    );
    if (row) {
      results.push({
        TaskNo: row.TaskNo,
        description: row.description || "",
        hour: row.hour || 0,
        workArea: row["Work Area"] || "", // Assicurati che la colonna sia denominata "Work Area" nel file Excel
        Special: row.Special || ""
      });
    }
  });

  // Calcola il totale delle hour
  const totalHours = results.reduce((sum, row) => sum + Number(row.hour || 0), 0);

  res.render('quotazione', {
    results: results,
    totalHours: totalHours,
    taskCardIds: taskCardIds,
    selectedAirplane: selectedAirplane
  });
});

/**
 * Route: GET /reset
 * Resetta i dati e torna alla pagina Task Card per una nuova interrogazione.
 */
app.get('/reset', (req, res) => {
  selectedAirplane = null;
  taskCardIds = [];
  res.redirect('/task-card');
});

app.listen(port, () => {
  console.log(`Server in ascolto sulla porta ${port}`);
});
