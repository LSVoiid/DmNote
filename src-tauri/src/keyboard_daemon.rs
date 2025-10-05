use std::io::{self, Write};

use anyhow::{anyhow, Result};
use bincode::Options;
use willhook::{
    hook::event::{InputEvent, KeyPress},
    keyboard_hook,
};

use crate::{
    ipc::{HookKeyState, HookMessage},
    keyboard_labels::{build_key_labels, should_skip_keyboard_event},
};

pub fn run() -> Result<()> {
    let Some(hook) = keyboard_hook() else {
        return Err(anyhow!("failed to install global keyboard hook"));
    };

    let mut stdout = io::BufWriter::with_capacity(4096, io::stdout());
    let codec = bincode::DefaultOptions::new()
        .with_fixint_encoding()
        .allow_trailing_bytes();

    loop {
        match hook.recv() {
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

                codec
                    .serialize_into(&mut stdout, &message)
                    .map_err(|err| anyhow!("failed to serialize keyboard event: {err}"))?;
                stdout.flush()?;
            }
            Ok(_) => {}
            Err(_) => break,
        }
    }

    Ok(())
}
