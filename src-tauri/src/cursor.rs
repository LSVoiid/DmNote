//! macOS 커서 설정 읽기 모듈
//! NSUserDefaults에서 com.apple.universalaccess 도메인의 커서 설정을 읽어옵니다.

#[cfg(target_os = "macos")]
use objc::{msg_send, sel, sel_impl, class, runtime::Object};

/// macOS 시스템 커서 설정
#[derive(Debug, Clone, serde::Serialize)]
pub struct MacOSCursorSettings {
    /// 커서 크기 배율 (1.0 ~ 4.0, 기본값 1.0)
    pub size: f64,
    /// 커서 채우기 색상 (RGB 배열 [r, g, b], 각 0.0~1.0)
    pub fill_color: Option<[f64; 3]>,
    /// 커서 테두리 색상 (RGB 배열 [r, g, b], 각 0.0~1.0)
    pub outline_color: Option<[f64; 3]>,
}

impl Default for MacOSCursorSettings {
    fn default() -> Self {
        Self {
            size: 1.0,
            fill_color: Some([0.0, 0.0, 0.0]),      // 기본 검정
            outline_color: Some([1.0, 1.0, 1.0]),   // 기본 흰색
        }
    }
}

#[cfg(target_os = "macos")]
pub fn get_macos_cursor_settings() -> MacOSCursorSettings {
    unsafe {
        // NSUserDefaults 가져오기
        let user_defaults: *mut Object = msg_send![class!(NSUserDefaults), standardUserDefaults];
        
        // com.apple.universalaccess 도메인에서 설정 읽기
        let domain = create_nsstring("com.apple.universalaccess");
        let prefs: *mut Object = msg_send![user_defaults, persistentDomainForName: domain];
        
        let mut settings = MacOSCursorSettings::default();
        
        if prefs.is_null() {
            return settings;
        }
        
        // 커서 크기 읽기 (mouseDriverCursorSize)
        let size_key = create_nsstring("mouseDriverCursorSize");
        let size_value: *mut Object = msg_send![prefs, objectForKey: size_key];
        if !size_value.is_null() {
            let size: f64 = msg_send![size_value, doubleValue];
            if size >= 1.0 && size <= 4.0 {
                settings.size = size;
            }
        }
        
        // 커서 채우기 색상 읽기 (mouseDriverCursorFillColor)
        if let Some(color) = read_color_from_prefs(prefs, "mouseDriverCursorFillColor") {
            settings.fill_color = Some(color);
        }
        
        // 커서 테두리 색상 읽기 (mouseDriverCursorOutlineColor)  
        if let Some(color) = read_color_from_prefs(prefs, "mouseDriverCursorOutlineColor") {
            settings.outline_color = Some(color);
        }
        
        settings
    }
}

#[cfg(target_os = "macos")]
unsafe fn read_color_from_prefs(prefs: *mut Object, key: &str) -> Option<[f64; 3]> {
    let color_key = create_nsstring(key);
    let color_data: *mut Object = msg_send![prefs, objectForKey: color_key];
    
    if color_data.is_null() {
        return None;
    }
    
    // NSData를 NSColor로 언아카이브 시도
    // macOS는 커서 색상을 NSKeyedArchiver로 저장함
    let unarchiver_class = class!(NSKeyedUnarchiver);
    let unarchived: *mut Object = msg_send![unarchiver_class, 
        unarchiveObjectWithData: color_data];
    
    if unarchived.is_null() {
        return None;
    }
    
    // NSColor에서 RGB 값 추출
    // sRGB 색상 공간으로 변환
    let color_space = class!(NSColorSpace);
    let srgb_space: *mut Object = msg_send![color_space, sRGBColorSpace];
    let converted: *mut Object = msg_send![unarchived, colorUsingColorSpace: srgb_space];
    
    if converted.is_null() {
        return None;
    }
    
    let r: f64 = msg_send![converted, redComponent];
    let g: f64 = msg_send![converted, greenComponent];
    let b: f64 = msg_send![converted, blueComponent];
    
    Some([r, g, b])
}

#[cfg(target_os = "macos")]
unsafe fn create_nsstring(s: &str) -> *mut Object {
    let cls = class!(NSString);
    let bytes = s.as_ptr();
    msg_send![cls, stringWithUTF8String: bytes]
}

#[cfg(not(target_os = "macos"))]
pub fn get_macos_cursor_settings() -> MacOSCursorSettings {
    MacOSCursorSettings::default()
}

/// 색상 배열을 HEX 문자열로 변환
pub fn rgb_to_hex(rgb: [f64; 3]) -> String {
    let r = (rgb[0] * 255.0).round() as u8;
    let g = (rgb[1] * 255.0).round() as u8;
    let b = (rgb[2] * 255.0).round() as u8;
    format!("#{:02X}{:02X}{:02X}", r, g, b)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_rgb_to_hex() {
        assert_eq!(rgb_to_hex([0.0, 0.0, 0.0]), "#000000");
        assert_eq!(rgb_to_hex([1.0, 1.0, 1.0]), "#FFFFFF");
        assert_eq!(rgb_to_hex([1.0, 0.0, 0.0]), "#FF0000");
    }
}
