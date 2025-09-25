


Pasos básicos para iniciar app:

*   Instalar node 22.11 ( con nvm ubuntu)
    
*   instalar git
    
*   clonar proyecto: [https://github.com/benjamcadev/dwight\_IA.git](https://github.com/benjamcadev/dwight_IA.git)
    
*   instalar dependencias : npm install
    
*   si aparece error hnswlib-node porque falta make y herramientas de compilación python, instalar sudo apt install -y build-essential python3
    
*   instalar pm2: npm install -g pm2
    
*   configurar firewall Ufw en ubuntu: port 4000
    

En esta sección, esta el paso a paso de como pasar de node-llama-cpp (librería de node para correr un modelo .gguf) a buldear para usar llama.cpp y levantar un servicio con el modelo en .gguf, esto para aprovechar todos los core de un servidor.

1.  Dentro de la carpeta del proyecto instalar dependencias para compilar: sudo apt install -y build-essential cmake libopenblas-dev libcurl4-openssl-dev
    
2.  Clonar llama.cpp git clone https://github.com/ggerganov/llama.cpp
    
3.  cd llama.cpp
    
4.  Crear carpeta build y configurar cmake: mkdir build cd build cmake .. -DLLAMA\_BLAS=ON -DLLAMA\_BLAS\_VENDOR=OpenBLAS
    
5.  si aparecen error relacionado con libcurl instalar libcurl4-openssl-dev
    
6.  Compilar usando los 16 cores por ejemplo: cmake --build . --config Release -j16
    
7.  Verificar que existan binarios en carpeta bin, como llama-server, llama-cli: ls ./bin
    
8.  Puedes probar el modelo LLM: ./bin/llama-bench -t 16 -m ../../models/gemma-2-2b-it.q4\_k\_m.gguf
    
9.  Levantar el server de llama: ./bin/llama-server \\
    
    \-m ../../models/gemma-2-2b-it.q4\_k\_m.gguf \\
    
    \-c 2048 \\
    
    \-t 16 \\
    
    \--host 0.0.0.0 \\
    
    \--port 5000
    

10. Probar: curl -X POST http://localhost:5000/completion \\

\-H "Content-Type: application/json" \\

Dato opcional: para correr el server llama.cpp con pm2 : 
pm2 start ./bin/llama-server -- -m /ruta/al/modelo -t 16 --port 5000
pm2 save
pm2 status
