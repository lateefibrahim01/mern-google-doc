// Import necessary libraries and modules
import { useCallback, useEffect, useState } from "react";
import QuillEditor from "quill";
import "quill/dist/quill.snow.css";
import { io } from "socket.io-client";
import { useParams } from "react-router-dom";

// Constants
const AUTO_SAVE_INTERVAL_MS = 2000; // Time interval to auto-save the document
const QUILL_TOOLBAR_OPTIONS = [
  // Quill.js toolbar options
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ font: [] }],
  [{ list: "ordered" }, { list: "bullet" }],
  ["bold", "italic", "underline"],
  [{ color: [] }, { background: [] }],
  [{ script: "sub" }, { script: "super" }],
  [{ align: [] }],
  ["image", "blockquote", "code-block"],
  ["clean"],
];

// Main TextEditor component
export default function UniqueTextEditor() {
  // Get the 'documentId' from the URL params using 'useParams' hook
  const { id: documentId } = useParams();

  // State variables for Socket.io and Quill instances
  const [socketConnection, setSocketConnection] = useState();
  const [quillEditor, setQuillEditor] = useState();

  // Effect hook to connect to the Socket.io server and handle disconnection
  useEffect(() => {
    const socket = io("http://localhost:3001");
    setSocketConnection(socket);

    return () => {
      socket.disconnect();
    };
  }, []);

  // Effect hook to load the document content from the server when the socket and quillEditor are ready
  useEffect(() => {
    if (socketConnection == null || quillEditor == null) return;

    socketConnection.once("load-document", (documentContent) => {
      quillEditor.setContents(documentContent); // Set the Quill editor content
      quillEditor.enable(); // Enable editing
    });

    socketConnection.emit("get-document", documentId); // Request the document content from the server
  }, [socketConnection, quillEditor, documentId]);

  // Effect hook to auto-save the document at regular intervals
  useEffect(() => {
    if (socketConnection == null || quillEditor == null) return;

    const autoSaveInterval = setInterval(() => {
      socketConnection.emit("save-document", quillEditor.getContents()); // Emit the current content to the server for saving
    }, AUTO_SAVE_INTERVAL_MS);

    return () => {
      clearInterval(autoSaveInterval); // Clear the interval when the component unmounts
    };
  }, [socketConnection, quillEditor]);

  // Effect hook to receive changes from other users and update the Quill editor content
  useEffect(() => {
    if (socketConnection == null || quillEditor == null) return;

    const changeHandler = (delta) => {
      quillEditor.updateContents(delta); // Update the content based on the received changes
    };
    socketConnection.on("receive-changes", changeHandler);

    return () => {
      socketConnection.off("receive-changes", changeHandler); // Remove the event listener when the component unmounts
    };
  }, [socketConnection, quillEditor]);

  // Effect hook to handle user's changes and send them to other users
  useEffect(() => {
    if (socketConnection == null || quillEditor == null) return;

    const userChangeHandler = (delta, oldDelta, source) => {
      if (source !== "user") return; // Only send changes made by the user (not by receiving from the server)
      socketConnection.emit("send-changes", delta); // Emit the user's changes to the server for broadcasting to other users
    };
    quillEditor.on("text-change", userChangeHandler);

    return () => {
      quillEditor.off("text-change", userChangeHandler); // Remove the event listener when the component unmounts
    };
  }, [socketConnection, quillEditor]);

  // useCallback hook to create the Quill editor instance when the component mounts or updates
  const quillEditorRef = useCallback((wrapper) => {
    if (wrapper == null) return;

    // Clear the wrapper's content and create a new Quill editor
    wrapper.innerHTML = "";
    const editorContainer = document.createElement("div");
    wrapper.append(editorContainer);
    const quill = new QuillEditor(editorContainer, {
      theme: "snow", // Set the Quill theme
      modules: { toolbar: QUILL_TOOLBAR_OPTIONS }, // Set the toolbar options
    });
    quill.disable(); // Disable editing until the document is loaded
    quill.setText("Loading..."); // Show "Loading..." text initially
    setQuillEditor(quill); // Set the Quill editor instance in the state
  }, []);

  // Render the container element with the quillEditorRef applied to it
  return <div className="editor-container" ref={quillEditorRef}></div>;
}
