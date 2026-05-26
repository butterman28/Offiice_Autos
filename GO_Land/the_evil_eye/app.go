package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"image/png"
	"os"
	"path/filepath"

	"github.com/kbinani/screenshot"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// GetDisplayNames returns a list of available display names/IDs
func (a *App) GetDisplayNames() []map[string]interface{} {
	displays := screenshot.NumActiveDisplays()
	var result []map[string]interface{}

	for i := 0; i < displays; i++ {
		bounds := screenshot.GetDisplayBounds(i)
		result = append(result, map[string]interface{}{
			"id":     i,
			"name":   fmt.Sprintf("Display %d", i),
			"x":      bounds.Min.X,
			"y":      bounds.Min.Y,
			"width":  bounds.Dx(),
			"height": bounds.Dy(),
		})
	}
	return result
}

// CaptureScreenshot captures a screenshot and returns it as base64 PNG
// displayID: -1 for all displays, or specific display index
// x, y, width, height: region to capture (0,0,0,0 for full display)
// CaptureScreenshot captures a screenshot and returns it as base64 PNG
// CaptureScreenshot captures a screenshot and returns it as base64 PNG
func (a *App) CaptureScreenshot(displayID int, x, y, width, height int) (map[string]interface{}, error) {
    // 🎭 Hide our app window first so it doesn't appear in the screenshot
    if a.ctx != nil {
        runtime.WindowHide(a.ctx)
        // Small delay to ensure window is hidden before capture
        time.Sleep(100 * time.Millisecond)
    }

    // Ensure we show the window again when done (defer is perfect here)
    defer func() {
        if a.ctx != nil {
            runtime.WindowShow(a.ctx)
        }
    }()

    var img *image.RGBA
    var err error

    if width <= 0 || height <= 0 {
        img, err = screenshot.CaptureDisplay(displayID)
    } else {
        img, err = screenshot.CaptureRect(image.Rect(x, y, x+width, y+height))
    }

    if err != nil {
        return nil, fmt.Errorf("failed to capture screenshot: %w", err)
    }

    var buf bytes.Buffer
    if err := png.Encode(&buf, img); err != nil {
        return nil, fmt.Errorf("failed to encode image: %w", err)
    }

    base64Str := base64.StdEncoding.EncodeToString(buf.Bytes())

    return map[string]interface{}{
        "imageBase64": base64Str,
        "width":       img.Bounds().Dx(),
        "height":      img.Bounds().Dy(),
    }, nil
}

// SaveScreenshot captures and saves screenshot to file
func (a *App) SaveScreenshot(displayID int, x, y, width, height int, filePath string) (string, error) {
    // Hide window before capture
    if a.ctx != nil {
        runtime.WindowHide(a.ctx)
        time.Sleep(100 * time.Millisecond)
    }
    defer func() {
        if a.ctx != nil {
            runtime.WindowShow(a.ctx)
        }
    }()

    // ... rest of the function stays the same ...
    var img *image.RGBA
    var err error

    if width <= 0 || height <= 0 {
        img, err = screenshot.CaptureDisplay(displayID)
    } else {
        img, err = screenshot.CaptureRect(image.Rect(x, y, x+width, y+height))
    }

    if err != nil {
        return "", fmt.Errorf("failed to capture screenshot: %w", err)
    }

    dir := filepath.Dir(filePath)
    if err := os.MkdirAll(dir, 0755); err != nil {
        return "", fmt.Errorf("failed to create directory: %w", err)
    }

    file, err := os.Create(filePath)
    if err != nil {
        return "", fmt.Errorf("failed to create file: %w", err)
    }
    defer file.Close()

    if err := png.Encode(file, img); err != nil {
        return "", fmt.Errorf("failed to save image: %w", err)
    }

    absPath, _ := filepath.Abs(filePath)
    return absPath, nil
}