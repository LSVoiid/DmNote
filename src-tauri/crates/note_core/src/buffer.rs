use std::collections::HashMap;

use crate::MAX_NOTES;

const NOTE_MESSAGE_MAGIC: u32 = 0x444D_4E54; // "DMNT"
const NOTE_MESSAGE_HEADER_BYTES: usize = 24;

#[derive(Debug)]
pub struct NoteBuffer {
    pub note_info: Vec<f32>,
    pub note_size: Vec<f32>,
    pub note_color_top: Vec<f32>,
    pub note_color_bottom: Vec<f32>,
    pub note_radius: Vec<f32>,
    pub track_index: Vec<f32>,
    pub note_glow: Vec<f32>,
    pub note_glow_color_top: Vec<f32>,
    pub note_glow_color_bottom: Vec<f32>,
    pub note_id_by_index: Vec<u64>,
    pub index_by_note_id: HashMap<u64, usize>,
    pub note_key_by_id: HashMap<u64, String>,
    pub active_count: usize,
    pub version: u32,
}

impl NoteBuffer {
    pub fn new() -> Self {
        Self {
            note_info: vec![0.0; MAX_NOTES * 3],
            note_size: vec![0.0; MAX_NOTES * 2],
            note_color_top: vec![0.0; MAX_NOTES * 4],
            note_color_bottom: vec![0.0; MAX_NOTES * 4],
            note_radius: vec![0.0; MAX_NOTES],
            track_index: vec![0.0; MAX_NOTES],
            note_glow: vec![0.0; MAX_NOTES * 3],
            note_glow_color_top: vec![0.0; MAX_NOTES * 3],
            note_glow_color_bottom: vec![0.0; MAX_NOTES * 3],
            note_id_by_index: vec![0; MAX_NOTES],
            index_by_note_id: HashMap::new(),
            note_key_by_id: HashMap::new(),
            active_count: 0,
            version: 0,
        }
    }

    pub(crate) fn allocate(
        &mut self,
        note_id: u64,
        track_key: &str,
        start_time: f32,
        layout: &crate::system::TrackLayoutNormalized,
    ) -> i32 {
        if self.active_count >= MAX_NOTES {
            return -1;
        }

        let mut insert_index = self.active_count;
        for i in 0..self.active_count {
            if self.track_index[i] > layout.track_index {
                insert_index = i;
                break;
            }
        }

        let old_count = self.active_count;
        if insert_index < old_count {
            self.note_info
                .copy_within(insert_index * 3..old_count * 3, (insert_index + 1) * 3);
            self.note_size
                .copy_within(insert_index * 2..old_count * 2, (insert_index + 1) * 2);
            self.note_color_top
                .copy_within(insert_index * 4..old_count * 4, (insert_index + 1) * 4);
            self.note_color_bottom
                .copy_within(insert_index * 4..old_count * 4, (insert_index + 1) * 4);
            self.note_radius
                .copy_within(insert_index..old_count, insert_index + 1);
            self.track_index
                .copy_within(insert_index..old_count, insert_index + 1);
            self.note_glow
                .copy_within(insert_index * 3..old_count * 3, (insert_index + 1) * 3);
            self.note_glow_color_top
                .copy_within(insert_index * 3..old_count * 3, (insert_index + 1) * 3);
            self.note_glow_color_bottom
                .copy_within(insert_index * 3..old_count * 3, (insert_index + 1) * 3);
            self.note_id_by_index
                .copy_within(insert_index..old_count, insert_index + 1);

            for i in insert_index + 1..=old_count {
                let moved_id = self.note_id_by_index[i];
                if moved_id != 0 {
                    self.index_by_note_id.insert(moved_id, i);
                }
            }
        }

        self.active_count = old_count + 1;

        let info_offset = insert_index * 3;
        self.note_info[info_offset] = start_time;
        self.note_info[info_offset + 1] = 0.0;
        self.note_info[info_offset + 2] = layout.track_x;

        let size_offset = insert_index * 2;
        self.note_size[size_offset] = layout.width;
        self.note_size[size_offset + 1] = layout.track_bottom_y;

        let color_offset = insert_index * 4;
        self.note_color_top[color_offset] = layout.color_top[0];
        self.note_color_top[color_offset + 1] = layout.color_top[1];
        self.note_color_top[color_offset + 2] = layout.color_top[2];
        self.note_color_top[color_offset + 3] = layout.opacity_top;

        self.note_color_bottom[color_offset] = layout.color_bottom[0];
        self.note_color_bottom[color_offset + 1] = layout.color_bottom[1];
        self.note_color_bottom[color_offset + 2] = layout.color_bottom[2];
        self.note_color_bottom[color_offset + 3] = layout.opacity_bottom;

        self.note_radius[insert_index] = layout.border_radius;
        self.track_index[insert_index] = layout.track_index;

        let glow_offset = insert_index * 3;
        self.note_glow[glow_offset] = layout.glow_size;
        self.note_glow[glow_offset + 1] = layout.glow_opacity_top;
        self.note_glow[glow_offset + 2] = layout.glow_opacity_bottom;

        self.note_glow_color_top[glow_offset] = layout.glow_color_top[0];
        self.note_glow_color_top[glow_offset + 1] = layout.glow_color_top[1];
        self.note_glow_color_top[glow_offset + 2] = layout.glow_color_top[2];

        self.note_glow_color_bottom[glow_offset] = layout.glow_color_bottom[0];
        self.note_glow_color_bottom[glow_offset + 1] = layout.glow_color_bottom[1];
        self.note_glow_color_bottom[glow_offset + 2] = layout.glow_color_bottom[2];

        self.note_id_by_index[insert_index] = note_id;
        self.index_by_note_id.insert(note_id, insert_index);
        self.note_key_by_id.insert(note_id, track_key.to_string());
        self.version = self.version.wrapping_add(1);
        insert_index as i32
    }

    pub fn finalize(&mut self, note_id: u64, end_time: f32) -> i32 {
        let Some(&index) = self.index_by_note_id.get(&note_id) else {
            return -1;
        };
        self.note_info[index * 3 + 1] = end_time;
        self.version = self.version.wrapping_add(1);
        index as i32
    }

    pub fn release(&mut self, note_id: u64) -> i32 {
        let Some(index) = self.index_by_note_id.get(&note_id).copied() else {
            return -1;
        };
        if self.active_count == 0 {
            return -1;
        }
        let last = self.active_count - 1;

        if index < last {
            let next = index + 1;
            let total_info = self.active_count * 3;
            let total_size = self.active_count * 2;
            let total_color = self.active_count * 4;

            self.note_info.copy_within(next * 3..total_info, index * 3);
            self.note_size.copy_within(next * 2..total_size, index * 2);
            self.note_color_top
                .copy_within(next * 4..total_color, index * 4);
            self.note_color_bottom
                .copy_within(next * 4..total_color, index * 4);
            self.note_radius.copy_within(next..self.active_count, index);
            self.track_index.copy_within(next..self.active_count, index);
            self.note_glow
                .copy_within(next * 3..self.active_count * 3, index * 3);
            self.note_glow_color_top
                .copy_within(next * 3..self.active_count * 3, index * 3);
            self.note_glow_color_bottom
                .copy_within(next * 3..self.active_count * 3, index * 3);
            self.note_id_by_index.copy_within(next..self.active_count, index);

            for i in index..last {
                let moved_id = self.note_id_by_index[i];
                if moved_id != 0 {
                    self.index_by_note_id.insert(moved_id, i);
                }
            }
        }

        self.note_id_by_index[last] = 0;
        self.index_by_note_id.remove(&note_id);
        self.note_key_by_id.remove(&note_id);
        self.active_count = last;

        let info_offset = last * 3;
        self.note_info[info_offset..info_offset + 3].fill(0.0);
        let size_offset = last * 2;
        self.note_size[size_offset..size_offset + 2].fill(0.0);
        let color_offset = last * 4;
        self.note_color_top[color_offset..color_offset + 4].fill(0.0);
        self.note_color_bottom[color_offset..color_offset + 4].fill(0.0);
        self.note_radius[last] = 0.0;
        self.track_index[last] = 0.0;
        let glow_offset = last * 3;
        self.note_glow[glow_offset..glow_offset + 3].fill(0.0);
        self.note_glow_color_top[glow_offset..glow_offset + 3].fill(0.0);
        self.note_glow_color_bottom[glow_offset..glow_offset + 3].fill(0.0);

        self.version = self.version.wrapping_add(1);
        index as i32
    }

    pub fn clear(&mut self) {
        self.active_count = 0;
        self.version = self.version.wrapping_add(1);
        self.index_by_note_id.clear();
        self.note_key_by_id.clear();
        self.note_id_by_index.fill(0);
        self.note_info.fill(0.0);
        self.note_size.fill(0.0);
        self.note_color_top.fill(0.0);
        self.note_color_bottom.fill(0.0);
        self.note_radius.fill(0.0);
        self.track_index.fill(0.0);
        self.note_glow.fill(0.0);
        self.note_glow_color_top.fill(0.0);
        self.note_glow_color_bottom.fill(0.0);
    }

    pub fn serialize_active(&self, msg_type: u8) -> Vec<u8> {
        let active = self.active_count.min(MAX_NOTES);
        let body_bytes = active * 24 * 4;
        let mut out = Vec::with_capacity(NOTE_MESSAGE_HEADER_BYTES + body_bytes);

        out.extend_from_slice(&NOTE_MESSAGE_MAGIC.to_le_bytes());
        out.push(msg_type);
        out.extend_from_slice(&[0u8; 3]);
        out.extend_from_slice(&self.version.to_le_bytes());
        out.extend_from_slice(&(active as u32).to_le_bytes());
        out.extend_from_slice(&(MAX_NOTES as u32).to_le_bytes());
        out.extend_from_slice(&0u32.to_le_bytes());

        if active == 0 {
            return out;
        }

        let info_len = active * 3;
        let size_len = active * 2;
        let color_len = active * 4;
        let radius_len = active;
        let glow_len = active * 3;

        out.extend_from_slice(as_u8_slice(&self.note_info[..info_len]));
        out.extend_from_slice(as_u8_slice(&self.note_size[..size_len]));
        out.extend_from_slice(as_u8_slice(&self.note_color_top[..color_len]));
        out.extend_from_slice(as_u8_slice(&self.note_color_bottom[..color_len]));
        out.extend_from_slice(as_u8_slice(&self.note_radius[..radius_len]));
        out.extend_from_slice(as_u8_slice(&self.note_glow[..glow_len]));
        out.extend_from_slice(as_u8_slice(&self.note_glow_color_top[..glow_len]));
        out.extend_from_slice(as_u8_slice(&self.note_glow_color_bottom[..glow_len]));
        out.extend_from_slice(as_u8_slice(&self.track_index[..radius_len]));

        out
    }
}

fn as_u8_slice(slice: &[f32]) -> &[u8] {
    unsafe { std::slice::from_raw_parts(slice.as_ptr() as *const u8, slice.len() * 4) }
}
