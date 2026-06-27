import React, { useRef } from "react";
import { Editor } from "@tinymce/tinymce-react";

export default function BlogEditor({
  value,
  onChange,
  onUploadImage,
  disabled = false,
  toolbarEnd = null,
}) {
  const editorRef = useRef(null);

  const handleImageUpload = async (blobInfo, progress) => {
    if (!onUploadImage) {
      return Promise.reject("Image upload is not supported.");
    }
    try {
      const file = blobInfo.blob();
      const url = await onUploadImage(file);
      if (url) {
        return url;
      } else {
        return Promise.reject("Upload failed, no URL returned.");
      }
    } catch (error) {
      return Promise.reject("Image upload failed: " + error.message);
    }
  };

  return (
    <div className="space-y-3">
      {toolbarEnd && (
        <div className="flex justify-end">
          {toolbarEnd}
        </div>
      )}
      <style>{`
        .tox-promotion {
          display: none !important;
        }
      `}</style>
      <div className="border border-border rounded-2xl overflow-hidden bg-background">
        <Editor
          apiKey={import.meta.env.VITE_TINYMCE_API_KEY}
          onInit={(_evt, editor) => (editorRef.current = editor)}
          value={value}
          onEditorChange={(content) => onChange(content)}
          disabled={disabled}
          init={{
            height: 700,
            menubar: true,
            resize: true,
            plugins: [
              "advlist",
              "anchor",
              "autolink",
              "autosave",
              "charmap",
              "code",
              "codesample",
              "directionality",
              "emoticons",
              "fullscreen",
              "help",
              "image",
              "importcss",
              "insertdatetime",
              "link",
              "lists",
              "media",
              "preview",
              "searchreplace",
              "table",
              "visualblocks",
              "visualchars",
              "wordcount",
              "quickbars",
            ],
            toolbar:
              "undo redo | blocks fontfamily fontsize | addshape addtextbox freemove | " +
              "bold italic underline strikethrough forecolor backcolor | " +
              "alignleft aligncenter alignright alignjustify | " +
              "bullist numlist outdent indent | " +
              "blockquote hr table | link image media | " +
              "charmap emoticons codesample | " +
              "preview fullscreen visualblocks | removeformat wordcount",
            autosave_interval: "20s",
            autosave_retention: "30m",
            autosave_ask_before_unload: true,
            images_upload_handler: handleImageUpload,
            image_advtab: true,
            image_caption: true,
            quickbars_selection_toolbar: "bold italic | h2 h3 blockquote quicklink",
            quickbars_insert_toolbar: false,
            setup: (editor) => {
              let dragImage = null;
              let startX = 0;
              let startY = 0;
              let startLeft = 0;
              let startTop = 0;

              // Add a custom button to toggle absolute positioning
              editor.ui.registry.addButton('freemove', {
                icon: 'arrows-out',
                tooltip: 'Toggle Free Move (Absolute Position)',
                onAction: () => {
                  let node = editor.selection.getNode();
                  // Traverse up to find custom text box if we are inside it
                  while (node && node.nodeName !== 'BODY' && !(node.classList && node.classList.contains('custom-text-box')) && node.nodeName !== 'IMG' && node.nodeName !== 'FIGURE') {
                    node = node.parentNode;
                  }

                  if (node && (node.nodeName === 'IMG' || node.nodeName === 'FIGURE' || (node.classList && node.classList.contains('custom-text-box')))) {
                    const dom = editor.dom;
                    if (dom.getStyle(node, 'position') === 'absolute') {
                      dom.setStyle(node, 'position', '');
                      dom.setStyle(node, 'left', '');
                      dom.setStyle(node, 'top', '');
                      dom.setStyle(node, 'z-index', '');
                      if (node.nodeName === 'IMG' || node.nodeName === 'FIGURE') dom.setAttrib(node, 'draggable', 'true');
                    } else {
                      dom.setStyle(node, 'position', 'absolute');
                      dom.setStyle(node, 'z-index', '100');
                      if (node.nodeName === 'IMG' || node.nodeName === 'FIGURE') dom.setAttrib(node, 'draggable', 'false');
                    }
                  } else {
                    alert("Please select an image, shape, or Text Box first to enable Free Move.");
                  }
                }
              });

              // Add a Text Box button
              editor.ui.registry.addButton('addtextbox', {
                icon: 'new-document',
                tooltip: 'Insert Text Box',
                onAction: () => {
                  editor.insertContent(`
                    <div class="custom-text-box" style="display:inline-block; border: 1px solid #cbd5e1; background: #ffffff; min-width: 200px; resize: both; overflow: hidden; margin: 10px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                      <div class="drag-handle" contenteditable="false" style="background: #f8fafc; padding: 4px; font-size: 12px; color: #64748b; cursor: grab; text-align: center; user-select: none; border-bottom: 1px solid #cbd5e1;">:: Drag Handle ::</div>
                      <div class="text-content" style="padding: 12px; min-height: 50px;">Type your text here...</div>
                    </div><p>&nbsp;</p>
                  `);
                }
              });

              // Add a Shapes dropdown menu
              editor.ui.registry.addMenuButton('addshape', {
                text: 'Shapes',
                icon: 'gallery',
                fetch: function (callback) {
                  const items = [
                    {
                      type: 'menuitem',
                      text: 'Square',
                      icon: 'unticked',
                      onAction: () => editor.insertContent('<img src="data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22100%22%20height%3D%22100%22%20viewBox%3D%220%200%20100%20100%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22100%22%20height%3D%22100%22%20fill%3D%22%233b82f6%22%2F%3E%3C%2Fsvg%3E" alt="Square" style="width: 100px; height: 100px;" />')
                    },
                    {
                      type: 'menuitem',
                      text: 'Circle',
                      icon: 'record',
                      onAction: () => editor.insertContent('<img src="data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22100%22%20height%3D%22100%22%20viewBox%3D%220%200%20100%20100%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2250%22%20fill%3D%22%233b82f6%22%2F%3E%3C%2Fsvg%3E" alt="Circle" style="width: 100px; height: 100px;" />')
                    },
                    {
                      type: 'menuitem',
                      text: 'Triangle',
                      icon: 'chevron-up',
                      onAction: () => editor.insertContent('<img src="data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22100%22%20height%3D%22100%22%20viewBox%3D%220%200%20100%20100%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpolygon%20points%3D%2250%2C0%20100%2C100%200%2C100%22%20fill%3D%22%233b82f6%22%2F%3E%3C%2Fsvg%3E" alt="Triangle" style="width: 100px; height: 100px;" />')
                    }
                  ];
                  callback(items);
                }
              });

              // Intercept mouse events for absolute dragging
              editor.on('mousedown', (e) => {
                const target = e.target;
                
                // Text Box dragging via handle
                if (target.classList && target.classList.contains('drag-handle')) {
                  const parentBox = target.closest ? target.closest('.custom-text-box') : null;
                  if (parentBox && editor.dom.getStyle(parentBox, 'position') === 'absolute') {
                    dragImage = parentBox;
                    startX = e.clientX;
                    startY = e.clientY;
                    startLeft = parseInt(editor.dom.getStyle(dragImage, 'left') || dragImage.offsetLeft || 0, 10);
                    startTop = parseInt(editor.dom.getStyle(dragImage, 'top') || dragImage.offsetTop || 0, 10);
                    e.preventDefault();
                    return;
                  }
                }

                // Image / Shape dragging
                if ((target.nodeName === 'IMG' || target.nodeName === 'FIGURE') && editor.dom.getStyle(target, 'position') === 'absolute') {
                  dragImage = target;
                  startX = e.clientX;
                  startY = e.clientY;
                  startLeft = parseInt(editor.dom.getStyle(dragImage, 'left') || dragImage.offsetLeft || 0, 10);
                  startTop = parseInt(editor.dom.getStyle(dragImage, 'top') || dragImage.offsetTop || 0, 10);
                  
                  // CRITICAL: Prevent native browser ghost dragging when absolute
                  e.preventDefault();
                }
              });

              editor.on('mousemove', (e) => {
                if (dragImage) {
                  const dx = e.clientX - startX;
                  const dy = e.clientY - startY;
                  editor.dom.setStyle(dragImage, 'left', (startLeft + dx) + 'px');
                  editor.dom.setStyle(dragImage, 'top', (startTop + dy) + 'px');
                  e.preventDefault();
                }
              });

              editor.on('mouseup', () => {
                if (dragImage) {
                  editor.undoManager.add();
                  dragImage = null;
                }
              });

              editor.on('mouseleave', () => {
                if (dragImage) {
                  dragImage = null;
                }
              });

              editor.on('NodeChange', (e) => {
                editor.dom.select('img').forEach((img) => {
                  // Make sure non-absolute images are draggable
                  if (editor.dom.getStyle(img, 'position') !== 'absolute' && editor.dom.getAttrib(img, 'draggable') !== 'true') {
                    editor.dom.setAttrib(img, 'draggable', 'true');
                  }
                });
              });
            },
            content_style:
              "body { font-family: Inter, system-ui, sans-serif; font-size: 16px; padding: 1rem; color: #1f2937; line-height: 1.6; }",
            branding: false,
            promotion: false,
            paste_data_images: true,
            automatic_uploads: true,
            file_picker_types: 'image',
          }}
        />
      </div>
    </div>
  );
}
