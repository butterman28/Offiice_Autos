import './style.css';
import './app.css';
import logo from './assets/images/logo-universal.png';
import { Greet, GetDisplayNames, CaptureScreenshot, SaveScreenshot } from '../wailsjs/go/main/App';

document.querySelector('#app').innerHTML = `
    <img id="logo" class="logo">
    <div class="result" id="result">Please enter your name below 👇</div>
    
    <!-- Screenshot Section -->
    <div class="screenshot-section">
        <h3>📸 Capture Screenshot</h3>
        
        <div class="input-box">
            <select id="displaySelect" class="input">
                <option value="-1">All Displays</option>
            </select>
            <button class="btn" onclick="capturePreview()">Preview</button>
            <button class="btn" onclick="saveScreenshot()">Save</button>
        </div>
        
        <div class="input-box">
            <label>Region (optional): </label>
            <input class="input" id="regionX" type="number" placeholder="X" style="width:50px" />
            <input class="input" id="regionY" type="number" placeholder="Y" style="width:50px" />
            <input class="input" id="regionW" type="number" placeholder="Width" style="width:60px" />
            <input class="input" id="regionH" type="number" placeholder="Height" style="width:60px" />
        </div>
        
        <div id="screenshotPreview" style="margin-top: 20px;">
            <img id="previewImage" style="max-width: 100%; border: 2px solid #555; display: none;" />
        </div>
        
        <div class="result" id="screenshotResult"></div>
    </div>
    
    <!-- Original Greet Section -->
    <div class="input-box" id="input" style="margin-top: 30px;">
        <input class="input" id="name" type="text" autocomplete="off" placeholder="Your name" />
        <button class="btn" onclick="greet()">Greet</button>
    </div>
`;

document.getElementById('logo').src = logo;

// Initialize
let nameElement = document.getElementById("name");
nameElement.focus();
let resultElement = document.getElementById("result");
let screenshotResult = document.getElementById("screenshotResult");
let previewImage = document.getElementById("previewImage");

// Load available displays on startup
async function loadDisplays() {
    try {
        const displays = await GetDisplayNames();
        const select = document.getElementById('displaySelect');
        displays.forEach(display => {
            const option = document.createElement('option');
            option.value = display.id;
            option.textContent = `${display.name} (${display.width}x${display.height})`;
            select.appendChild(option);
        });
    } catch (err) {
        console.error('Failed to load displays:', err);
    }
}
loadDisplays();

// Greet function (original)
window.greet = function () {
    let name = nameElement.value;
    if (name === "") return;
    try {
        Greet(name)
            .then((result) => {
                resultElement.innerText = result;
            })
            .catch((err) => console.error(err));
    } catch (err) {
        console.error(err);
    }
};

// Capture preview screenshot
window.capturePreview = async function() {
    const displayID = parseInt(document.getElementById('displaySelect').value);
    const x = parseInt(document.getElementById('regionX').value) || 0;
    const y = parseInt(document.getElementById('regionY').value) || 0;
    const width = parseInt(document.getElementById('regionW').value) || 0;
    const height = parseInt(document.getElementById('regionH').value) || 0;
    
    screenshotResult.innerText = "Capturing...";
    
    try {
        const result = await CaptureScreenshot(displayID, x, y, width, height);
        previewImage.src = `data:image/png;base64,${result.imageBase64}`;
        previewImage.style.display = 'block';
        screenshotResult.innerText = `Captured: ${result.width}x${result.height}px`;
    } catch (err) {
        screenshotResult.innerText = `Error: ${err.message}`;
        console.error(err);
    }
};

// Save screenshot to file
window.saveScreenshot = async function() {
    const displayID = parseInt(document.getElementById('displaySelect').value);
    const x = parseInt(document.getElementById('regionX').value) || 0;
    const y = parseInt(document.getElementById('regionY').value) || 0;
    const width = parseInt(document.getElementById('regionW').value) || 0;
    const height = parseInt(document.getElementById('regionH').value) || 0;
    
    // Default save path - customize as needed
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = `screenshots/screenshot_${timestamp}.png`;
    
    screenshotResult.innerText = "Saving...";
    
    try {
        const savedPath = await SaveScreenshot(displayID, x, y, width, height, filePath);
        screenshotResult.innerText = `Saved to: ${savedPath}`;
    } catch (err) {
        screenshotResult.innerText = `Error: ${err.message}`;
        console.error(err);
    }
};