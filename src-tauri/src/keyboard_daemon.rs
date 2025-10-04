use std::{
    io::{self, Write},
    thread,
    time::Duration,
};

use anyhow::{anyhow, Context, Result};
use serde::Serialize;
use willhook::{
    hook::event::{InputEvent, KeyPress},
    keyboard_hook,
};

use crate::keyboard_labels::{build_key_labels, should_skip_keyboard_event};

pub fn run() -> Result<()> {
    let Some(hook) = keyboard_hook() else {
        return Err(anyhow!("failed to install global keyboard hook"));
    };

    let mut stdout = io::BufWriter::new(io::stdout());

    loop {
        match hook.try_recv() {
            Ok(InputEvent::Keyboard(event)) => {
                if should_skip_keyboard_event(&event) {
                    continue;
                }

                let labels = build_key_labels(&event);
                if labels.is_empty() {
                    continue;
                }

                let state = match event.pressed {
                    KeyPress::Down(_) => HookKeyState::Down,
                    KeyPress::Up(_) => HookKeyState::Up,
                    _ => continue,
                };

                let message = HookMessage {
                    labels,
                    state,
                    vk_code: event.vk_code,
                    scan_code: event.scan_code,
                    flags: event.flags,
                };

                serde_json::to_writer(&mut stdout, &message)
                    .context("failed to serialize keyboard event")?;
                stdout.write_all(b"\n")?;
                stdout.flush()?;
            }
            Ok(_) => {}
            Err(std::sync::mpsc::TryRecvError::Empty) => {
                thread::sleep(Duration::from_millis(1));
            }
            Err(std::sync::mpsc::TryRecvError::Disconnected) => break,
        }
    }

    Ok(())
}

#[derive(Debug, Serialize)]
struct HookMessage {
    labels: Vec<String>,
    state: HookKeyState,
    #[serde(skip_serializing_if = "Option::is_none")]
    vk_code: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    scan_code: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    flags: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "UPPERCASE")]
enum HookKeyState {
    Down,
    Up,
}
