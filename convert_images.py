import os
from PIL import Image

def convert_to_webp(source_folder, output_folder, quality=80):
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)
        
    for filename in os.listdir(source_folder):
        if filename.lower().endswith(('.webp', '.webp', '.jpeg', '.tiff', '.bmp')):
            img_path = os.path.join(source_folder, filename)
            try:
                img = Image.open(img_path)
                
                # Handle RGBA to RGB conversion for formats that don't support alpha if needed, 
                # but WebP supports alpha, so we keep it.
                base_name = os.path.splitext(filename)[0]
                output_path = os.path.join(output_folder, f"{base_name}.webp")
                
                img.save(output_path, "WEBP", quality=quality)
                print(f"Converted: {filename} -> {base_name}.webp")
            except Exception as e:
                print(f"Failed to convert {filename}: {e}")

if __name__ == '__main__':
    # Your specified Google Drive path
    source = r"G:\My Drive\Fountain of Life Children_s Home\Main Project\images"
    
    # Creates a new folder called 'images_webp' inside your Main Project directory
    output = r"G:\My Drive\Fountain of Life Children_s Home\Main Project\images_webp"
    
    print("Starting conversion...")
    convert_to_webp(source, output)
    print("\nFinished! Your optimized images are in the 'images_webp' folder.")
    input("\nPress Enter to close this window...")
