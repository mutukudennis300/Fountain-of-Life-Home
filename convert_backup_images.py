import os
from PIL import Image

# Exact current paths
SOURCE_FOLDER = r"G:\My Drive\Fountain of Life Children_s Home\Main Project\images_backup"
OUTPUT_FOLDER = r"G:\My Drive\Fountain of Life Children_s Home\Main Project\images"

def convert_to_webp(source, output, quality=80):
    if not os.path.exists(output):
        os.makedirs(output)
        
    converted_count = 0
    skipped_count = 0
    
    for filename in os.listdir(source):
        if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.tiff', '.bmp')):
            base_name = os.path.splitext(filename)[0]
            output_filename = f"{base_name}.webp"
            output_path = os.path.join(output, output_filename)
            
            if os.path.exists(output_path):
                skipped_count += 1
                continue
                
            try:
                img_path = os.path.join(source, filename)
                img = Image.open(img_path)
                img.save(output_path, "WEBP", quality=quality)
                print(f"Success: {filename} -> {output_filename}")
                converted_count += 1
            except Exception as e:
                print(f"Error converting {filename}: {e}")
                
    print(f"\n🎉 Done! Successfully converted {converted_count} new images.")
    if skipped_count > 0:
        print(f"⏭️ Skipped {skipped_count} images because they were already in the destination folder.")

if __name__ == "__main__":
    print("Scanning backup folder for new images...")
    convert_to_webp(SOURCE_FOLDER, OUTPUT_FOLDER)

