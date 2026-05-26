package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/chromedp/chromedp"
)

func main() {
	// create context
	ctx, cancel := chromedp.NewContext(context.Background())
	defer cancel()

	// optional timeout
	ctx, cancel = context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	var screenshot []byte

	err := chromedp.Run(ctx,
		chromedp.Navigate("https://example.com"),
		chromedp.WaitVisible("body", chromedp.ByQuery),
		chromedp.FullScreenshot(&screenshot, 90),
	)
	if err != nil {
		log.Fatal(err)
	}

	err = os.WriteFile("screenshot.png", screenshot, 0644)
	if err != nil {
		log.Fatal(err)
	}

	log.Println("Screenshot saved as screenshot.png")
}

