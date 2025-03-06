How to connect and authenticate
Step-by-step guide on using our API via WebSockets for efficient and fast connection.
Authentication
To interact with the Runware API, you need to authenticate your requests using an API key. This key is unique to your account and is used to identify you when making requests. You can create multiple keys for different projects or environments (development, production, staging) , add descriptions to them, and revoke them at any time. With the new teams feature, you can also share keys with your team members.

To create an API key, simply sign up on Runware and visit the "API Keys" page. Then, click "Create Key" and fill the details for your new key.

HTTP (REST)
We recommend using WebSockets for a more efficient and faster connection. However, if you prefer to use a simpler connection and don't need to keep it open, you can use HTTP REST API.

The URL for the API is https://api.runware.ai/v1. All requests must be made using the POST method and the Content-Type header must be set to application/json.

The payload for each request is a JSON array with one or more objects. Each object represents a task to be executed by the API.

Authentication can be done by including the authentication object as the first element in the array, or by using the Authorization header with the value Bearer <API_KEY>.

curl --location 'https://api.runware.ai/v1' \
     --header 'Content-Type: application/json' \
     --data-raw '[
       {
         "taskType": "authentication",
         "apiKey": "<API_KEY>"
       },
       {
         "taskType": "imageInference",
         "taskUUID": "39d7207a-87ef-4c93-8082-1431f9c1dc97",
         "positivePrompt": "a cat",
         "width": 512,
         "height": 512,
         "model": "civitai:102438@133677",
         "numberResults": 1
       }
     ]'
The API will return a JSON object with the data property. This property is an array containing all the response objects. Each object will contain the taskType and the taskUUID of the request it's responding to, as well as other properties related to the task.

{
  "data": [
    {
      "taskType": "imageInference",
      "taskUUID": "39d7207a-87ef-4c93-8082-1431f9c1dc97",
      "imageUUID": "b7db282d-2943-4f12-992f-77df3ad3ec71",
      "imageURL": "https://im.runware.ai/image/ws/0.5/ii/b7db282d-2943-4f12-992f-77df3ad3ec71.jpg"
    }
  ]
}
If there's an error, the API will not return the data property. Instead, it will return the error property, containing the error message.

WebSockets
We support WebSocket connections as they are more efficient, faster, and less resource intensive. We have made our WebSocket connections easy to work with, as each response contains the request ID. So it's possible to easily match request → response.

The API uses a bidirectional protocol that encodes all messages as JSON objects.

To connect you can use one of the sdks we provide JavaScript, Python or manually.

If you prefer to connect manually (to use another language/technology), the endpoint URL is wss://ws-api.runware.ai/v1.

New connections
Request
WebSocket connections are point-to-point, so there's no need for each request to contain an authentication header.

Instead, the first request must always be an authentication request that includes the API key. This way we can identify which subsequent requests are arriving from the same user.

[
  {
    "taskType": "authentication",
    "apiKey": "<API_KEY>"
  }
]
Response
After you've made the authentication request the API will return an object with the connectionSessionUUID parameter. This string is unique to your connection and is used to resume connections in case of disconnection (more on this later).

{
  "data": [
    {
      "taskType": "authentication",
      "connectionSessionUUID": "f40c2aeb-f8a7-4af7-a1ab-7594c9bf778f"
    }
  ]
}
In case of error you will receive an object with the error message.

{
  "errors": [
    {
      "code": "invalidApiKey",
      "message": "Invalid API key. Get one at https://my.runware.ai/signup",
      "parameter": "apiKey",
      "type": "string",
      "taskType": "authentication"
    }
  ]
}
Keeping connection alive
The WebSocket connection is kept open for 120 seconds from the last message exchanged. If you don't send any messages for 120 seconds, the connection will be closed automatically.

To keep the connection going, you can send a ping message when needed, to which we will reply with a pong.

[
  {
    "taskType": "ping",
    "ping": true
  }
]
{
  "data": [
    {
      "taskType": "ping",
      "pong": true
    }
  ]
}
Resuming connections
If any service, server or network is unresponsive (for instance due to a restart), all the images or tasks that could not be delivered are kept in a buffer memory for 120 seconds. You can reconnect and have these messages delivered by including the connectionSessionUUID parameter in the initial authentication connection request.

[
  {
    "taskType": "authentication",
    "apiKey": "<API_KEY>",
    "connectionSessionUUID": "f40c2aeb-f8a7-4af7-a1ab-7594c9bf778f"
  }
]
This means that is not needed to make the same request again, the initial one will be delivered when reconnecting.

SDK libraries reconnects automatically.

On this page
Authentication
HTTP (REST)
WebSockets
New connections
Request
Response
Keeping connection alive
Resuming connections
Using SDK libraries
Python Library
Integrate Runware's API with our Python library. Get started with code examples and comprehensive usage instructions.
JavaScript Library
Integrate Runware's API with our JavaScript library. Get started with code examples and comprehensive usage instructions.

Image Inference API
Generate images from text prompts or transform existing ones using Runware's API. Learn how to do image inference for creative and high-quality results.
Introduction
Image inference is a powerful feature that allows you to generate images from text prompts or transform existing images according to your needs. This process is essential for creating high-quality visuals, whether you're looking to bring creative ideas to life or enhance existing images with new styles or subjects.

There are several types of image inference requests you can make using our API:

Text-to-Image: Generate images from descriptive text prompts. This process translates your text into high-quality visuals, allowing you to create detailed and vivid images based on your ideas.
Image-to-Image: Perform transformations on existing images, whether they are previously generated images or uploaded images. This process enables you to enhance, modify, or stylize images to create new and visually appealing content. With a single parameter you can control the strength of the transformation.
Inpainting: Replace parts of an image with new content, allowing you to remove unwanted elements or improve the overall composition of an image. It's like Image-to-Image but with a mask that defines the area to be transformed.
Outpainting: Extend the boundaries of an image by generating new content outside the original frame that seamlessly blends with the existing image. As Inpainting, it uses a mask to define the new area to be generated.
Our API also supports advanced features that allow developers to fine-tune the image generation process with precision:

ControlNet: A feature that enables precise control over image generation by using additional input conditions, such as edge maps, poses, or segmentation masks. This allows for more accurate alignment with specific user requirements or styles.
LoRA: A technique that helps in adapting models to specific styles or tasks by focusing on particular aspects of the data, enhancing the quality and relevance of the generated images.
Additionally, you can tweak numerous parameters to customize the output, such as adjusting the image dimension, steps, scheduler to use, and other generation settings, providing a high level of flexibility to suit your application's needs.

Our API is really fast because we have unique optimizations, custom-designed hardware, and many other elements that are part of our Sonic Inference Engine.

Request
Our API always accepts an array of objects as input, where each object represents a specific task to be performed. The structure of the object varies depending on the type of the task. For this section, we will focus on the parameters related to image inference tasks.

The following JSON snippets shows the basic structure of a request object. All properties are explained in detail in the next section.

[
  {
    "taskType": "imageInference",
    "taskUUID": "string",
    "outputType": "string",
    "outputFormat": "string",
    "positivePrompt": "string",
    "negativePrompt": "string",
    "height": int,
    "width": int,
    "model": "string",
    "steps": int,
    "CFGScale": float,
    "numberResults": int
  }
]
You can mix multiple ControlNet and LoRA objects in the same request to achieve more complex control over the generation process.

taskType
string
required
The type of task to be performed. For this task, the value should be imageInference.

taskUUID
string
required
UUID v4
When a task is sent to the API you must include a random UUID v4 string using the taskUUID parameter. This string is used to match the async responses to their corresponding tasks.

If you send multiple tasks at the same time, the taskUUID will help you match the responses to the correct tasks.

The taskUUID must be unique for each task you send to the API.

outputType
"base64Data" | "dataURI" | "URL"
Default: URL
Specifies the output type in which the image is returned. Supported values are: dataURI, URL, and base64Data.

base64Data: The image is returned as a base64-encoded string using the imageBase64Data parameter in the response object.
dataURI: The image is returned as a data URI string using the imageDataURI parameter in the response object.
URL: The image is returned as a URL string using the imageURL parameter in the response object.
outputFormat
"JPG" | "PNG" | "WEBP"
Default: JPG
Specifies the format of the output image. Supported formats are: PNG, JPG and WEBP.

outputQuality
integer
Min: 20
Max: 99
Default: 95
Sets the compression quality of the output image. Higher values preserve more quality but increase file size, lower values reduce file size but decrease quality.

uploadEndpoint
string
This parameter allows you to specify a URL to which the generated image will be uploaded as binary image data using the HTTP PUT method. For example, an S3 bucket URL can be used as the upload endpoint.

When the image is ready, it will be uploaded to the specified URL.

checkNSFW
boolean
Default: false
This parameter is used to enable or disable the NSFW check. When enabled, the API will check if the image contains NSFW (not safe for work) content. This check is done using a pre-trained model that detects adult content in images.

When the check is enabled, the API will return NSFWContent: true in the response object if the image is flagged as potentially sensitive content. If the image is not flagged, the API will return NSFWContent: false.

If this parameter is not used, the parameter NSFWContent will not be included in the response object.

Adds 0.1 seconds to image inference time and incurs additional costs.

The NSFW filter occasionally returns false positives and very rarely false negatives.

includeCost
boolean
Default: false
If set to true, the cost to perform the task will be included in the response object.

positivePrompt
string
required
A positive prompt is a text instruction to guide the model on generating the image. It is usually a sentence or a paragraph that provides positive guidance for the task. This parameter is essential to shape the desired results.

For example, if the positive prompt is "dragon drinking coffee", the model will generate an image of a dragon drinking coffee. The more detailed the prompt, the more accurate the results.

If you wish to generate an image without any prompt guidance, you can use the special token __BLANK__. This tells the system to generate an image without text-based instructions.

The length of the prompt must be between 2 and 3000 characters.

negativePrompt
string
A negative prompt is a text instruction to guide the model on generating the image. It is usually a sentence or a paragraph that provides negative guidance for the task. This parameter helps to avoid certain undesired results.

For example, if the negative prompt is "red dragon, cup", the model will follow the positive prompt but will avoid generating an image of a red dragon or including a cup. The more detailed the prompt, the more accurate the results.

The length of the prompt must be between 2 and 2000 characters.

seedImage
string
required
When doing Image-to-Image, Inpainting or Outpainting, this parameter is required.

Specifies the seed image to be used for the diffusion process. The image can be specified in one of the following formats:

An UUID v4 string of a previously uploaded image or a generated image.
A data URI string representing the image. The data URI must be in the format data:<mediaType>;base64, followed by the base64-encoded image. For example: data:image/png;base64,iVBORw0KGgo....
A base64 encoded image without the data URI prefix. For example: iVBORw0KGgo....
A URL pointing to the image. The image must be accessible publicly.
Supported formats are: PNG, JPG and WEBP.

maskImage
string
required
When doing Inpainting, this parameter is required.

Specifies the mask image to be used for the inpainting process. The image can be specified in one of the following formats:

An UUID v4 string of a previously uploaded image or a generated image.
A data URI string representing the image. The data URI must be in the format data:<mediaType>;base64, followed by the base64-encoded image. For example: data:image/png;base64,iVBORw0KGgo....
A base64 encoded image without the data URI prefix. For example: iVBORw0KGgo....
A URL pointing to the image. The image must be accessible publicly.
Supported formats are: PNG, JPG and WEBP.

maskMargin
integer
Min: 32
Max: 128
Adds extra context pixels around the masked region during inpainting. When this parameter is present, the model will zoom into the masked area, considering these additional pixels to create more coherent and well-integrated details.

This parameter is particularly effective when used with masks generated by the Image Masking API, enabling enhanced detail generation while maintaining natural integration with the surrounding image.

strength
float
Min: 0
Max: 1
Default: 0.8
When doing Image-to-Image or Inpainting, this parameter is used to determine the influence of the seedImage image in the generated output. A lower value results in more influence from the original image, while a higher value allows more creative deviation.

outpainting
object
Extends the image boundaries in specified directions. When using outpainting, you must provide the final dimensions using width and height parameters, which should account for the original image size plus the total extension (seedImage dimensions + top + bottom, left + right).

top
integer
Min: 0
Number of pixels to extend at the top of the image. Must be a multiple of 64.

right
integer
Min: 0
Number of pixels to extend at the right side of the image. Must be a multiple of 64.

bottom
integer
Min: 0
Number of pixels to extend at the bottom of the image. Must be a multiple of 64.

left
integer
Min: 0
Number of pixels to extend at the left side of the image. Must be a multiple of 64.

blur
integer
Min: 0
Max: 32
Default: 0
The amount of blur to apply at the boundaries between the original image and the extended areas, measured in pixels.

height
integer
required
Min: 128
Max: 2048
Used to define the height dimension of the generated image. Certain models perform better with specific dimensions.

The value must be divisible by 64, eg: 128...512, 576, 640...2048.

width
integer
required
Min: 128
Max: 2048
Used to define the width dimension of the generated image. Certain models perform better with specific dimensions.

The value must be divisible by 64, eg: 128...512, 576, 640...2048.

model
string
required
We make use of the AIR (Artificial Intelligence Resource) system to identify models. This identifier is a unique string that represents a specific model.

You can find the AIR identifier of the model you want to use in our Model Explorer, which is a tool that allows you to search for models based on their characteristics.

vae
string
We make use of the AIR (Artificial Intelligence Resource) system to identify VAE models. This identifier is a unique string that represents a specific model.

The VAE (Variational Autoencoder) can be specified to override the default one included with the base model, which can help improve the quality of generated images.

You can find the AIR identifier of the VAE model you want to use in our Model Explorer, which is a tool that allows you to search for models based on their characteristics.

steps
integer
Min: 1
Max: 100
Default: 20
The number of steps is the number of iterations the model will perform to generate the image. The higher the number of steps, the more detailed the image will be. However, increasing the number of steps will also increase the time it takes to generate the image and may not always result in a better image (some schedulers work differently).

When using your own models you can specify a new default value for the number of steps.

scheduler
string
Default: Model's scheduler
An scheduler is a component that manages the inference process. Different schedulers can be used to achieve different results like more detailed images, faster inference, or more accurate results.

The default scheduler is the one that the model was trained with, but you can choose a different one to get different results.

Schedulers are explained in more detail in the Schedulers page.

seed
integer
Min: 1
Max: 9223372036854776000
Default: Random
A seed is a value used to randomize the image generation. If you want to make images reproducible (generate the same image multiple times), you can use the same seed value.

When requesting multiple images with the same seed, the seed will be incremented by 1 (+1) for each image generated.

CFGScale
float
Min: 0
Max: 30
Default: 7
Guidance scale represents how closely the images will resemble the prompt or how much freedom the AI model has. Higher values are closer to the prompt. Low values may reduce the quality of the results.

clipSkip
integer
Min: 0
Max: 2
Defines additional layer skips during prompt processing in the CLIP model. Some models already skip layers by default - this parameter adds extra skips on top of those. Different values affect how your prompt is interpreted, which can lead to variations in the generated image.

promptWeighting
string
Defines the syntax to be used for prompt weighting.

Prompt weighting allows you to adjust how strongly different parts of your prompt influence the generated image. Choose between compel notation with advanced weighting operations or sdEmbeds for simple emphasis adjustments.


numberResults
integer
Min: 1
Max: 20
Default: 1
The number of images to generate from the specified prompt.

If seed is set, it will be incremented by 1 (+1) for each image generated.

refiner
object
Refiner models help create higher quality image outputs by incorporating specialized models designed to enhance image details and overall coherence. This can be particularly useful when you need results with superior quality, photorealism, or specific aesthetic refinements. Note that refiner models are only SDXL based.

The refiner parameter is an object that contains properties defining how the refinement process should be configured. You can find the properties of the refiner object below.

model
string
required
We make use of the AIR system to identify refinement models. This identifier is a unique string that represents a specific model. Note that refiner models are only SDXL based.

You can find the AIR identifier of the refinement model you want to use in our Model Explorer, which is a tool that allows you to search for models based on their characteristics.

More information about the AIR system can be found in the Models page.

startStep
integer
Min: 2
Max: {steps}
Represents the step number at which the refinement process begins. The initial model will generate the image up to this step, after which the refiner model takes over to enhance the result.

It can take values from 2 (second step) to the number of steps specified.

Alternative parameters: refiner.startStepPercentage.

startStepPercentage
integer
Min: 1
Max: 99
Represents the percentage of total steps at which the refinement process begins. The initial model will generate the image up to this percentage of steps before the refiner takes over.

It can take values from 1 to 99.

Alternative parameters: refiner.startStep.

embeddings
object[]
Embeddings (or Textual Inversion) can be used to add specific concepts or styles to your generations. Multiple embeddings can be used at the same time.

The embeddings parameter is an array of objects. Each object contains properties that define which embedding model to use. You can find the properties of the embeddings object below.

model
string
required
We make use of the AIR system to identify embeddings models. This identifier is a unique string that represents a specific model.

You can find the AIR identifier of the embeddings model you want to use in our Model Explorer, which is a tool that allows you to search for models based on their characteristics.

weight
float
Min: -4
Max: 4
Default: 1
Defines the strength or influence of the embeddings model in the generation process. The value can range from -4 (negative influence) to +4 (maximum influence).

It is possible to use multiple embeddings at the same time.

Example:

"embeddings": [
  { "model": "civitai:1044536@1172007", "weight": 1.5 },
  { "model": "civitai:993446@1113094", "weight": 0.8 }
]
controlNet
object[]
With ControlNet, you can provide a guide image to help the model generate images that align with the desired structure. This guide image can be generated with our ControlNet preprocessing tool, extracting guidance information from an input image. The guide image can be in the form of an edge map, a pose, a depth estimation or any other type of control image that guides the generation process via the ControlNet model.

Multiple ControlNet models can be used at the same time to provide different types of guidance information to the model.

The controlNet parameter is an array of objects. Each object contains properties that define the configuration for a specific ControlNet model. You can find the properties of the ControlNet object below.

model
string
required
For basic/common ControlNet models, you can check the list of available models here.

For custom or specific ControlNet models, we make use of the AIR system to identify ControlNet models. This identifier is a unique string that represents a specific model.

You can find the AIR identifier of the ControlNet model you want to use in our Model Explorer, which is a tool that allows you to search for models based on their characteristics.

More information about the AIR system can be found in the Models page.

guideImage
string
required
Specifies the preprocessed image to be used as guide to control the image generation process. The image can be specified in one of the following formats:

An UUID v4 string of a previously uploaded image or a generated image.
A data URI string representing the image. The data URI must be in the format data:<mediaType>;base64, followed by the base64-encoded image. For example: data:image/png;base64,iVBORw0KGgo....
A base64 encoded image without the data URI prefix. For example: iVBORw0KGgo....
A URL pointing to the image. The image must be accessible publicly.
Supported formats are: PNG, JPG and WEBP.

weight
float
Min: 0
Max: 1
Default: 1
Represents the strength or influence of this ControlNet model in the generation process. A value of 0 means no influence, while 1 means maximum influence.

startStep
integer
Min: 1
Max: {steps}
Represents the step number at which the ControlNet model starts to control the inference process.

It can take values from 1 (first step) to the number of steps specified.

Alternative parameters: controlNet.startStepPercentage.

startStepPercentage
integer
Min: 0
Max: 99
Represents the percentage of steps at which the ControlNet model starts to control the inference process.

It can take values from 0 to 99.

Alternative parameters: controlNet.startStep.

endStep
integer
Min: {startStep + 1}
Max: {steps}
Represents the step number at which the ControlNet preprocessor ends to control the inference process.

It can take values higher than startStep and less than or equal to the number of steps specified.

Alternative parameters: controlNet.endStepPercentage.

endStepPercentage
integer
Min: {startStepPercentage + 1}
Max: 100
Represents the percentage of steps at which the ControlNet model ends to control the inference process.

It can take values higher than startStepPercentage and lower than or equal to 100.

Alternative parameters: controlNet.endStep.

controlMode
string
This parameter has 3 options: prompt, controlnet and balanced.

prompt: Prompt is more important in guiding image generation.
controlnet: ControlNet is more important in guiding image generation.
balanced: Balanced operation of prompt and ControlNet.
lora
object[]
With LoRA (Low-Rank Adaptation), you can adapt a model to specific styles or features by emphasizing particular aspects of the data. This technique enhances the quality and relevance of the generated images and can be especially useful in scenarios where the generated images need to adhere to a specific artistic style or follow particular guidelines.

Multiple LoRA models can be used at the same time to achieve different adaptation goals.

The lora parameter is an array of objects. Each object contains properties that define the configuration for a specific LoRA model. You can find the properties of the LoRA object below.

model
string
required
We make use of the AIR system to identify LoRA models. This identifier is a unique string that represents a specific model.

You can find the AIR identifier of the LoRA model you want to use in our Model Explorer, which is a tool that allows you to search for models based on their characteristics.

More information about the AIR system can be found in the Models page.

Example: civitai:132942@146296.

weight
float
Min: -4
Max: 4
Default: 1
Defines the strength or influence of the LoRA model in the generation process. The value can range from -4 (negative influence) to +4 (maximum influence).

It is possible to use multiple LoRAs at the same time.

Example:

"lora": [
  { "model": "runware:13090@1", "weight": 1.5 },
  { "model": "runware:6638@1", "weight": 0.8 }
]
ipAdapters
object[]
IP-Adapters enable image-prompted generation, allowing you to use reference images to guide the style and content of your generations. Multiple IP Adapters can be used simultaneously.

The ipAdapters parameter is an array of objects. Each object contains properties that define which IP-Adapter model to use and how it should influence the generation. You can find the properties of the IP-Adapter object below.

model
string
required
We make use of the AIR system to identify IP-Adapter models. This identifier is a unique string that represents a specific model.

Currently supported models:

AIR ID	Model Name
runware:55@1	IP Adapter SDXL
runware:55@2	IP Adapter SDXL Plus
runware:55@3	IP Adapter SDXL Plus Face
runware:55@4	IP Adapter SDXL Vit-H
runware:55@5	IP Adapter SD 1.5
runware:55@6	IP Adapter SD 1.5 Plus
runware:55@7	IP Adapter SD 1.5 Light
runware:55@8	IP Adapter SD 1.5 Plus Face
runware:55@10	IP Adapter SD 1.5 Vit-G
guideImage
string
required
Specifies the reference image that will guide the generation process. The image can be specified in one of the following formats:

An UUID v4 string of a previously uploaded image or a generated image.
A data URI string representing the image. The data URI must be in the format data:<mediaType>;base64, followed by the base64-encoded image. For example: data:image/png;base64,iVBORw0KGgo....
A base64 encoded image without the data URI prefix. For example: iVBORw0KGgo....
A URL pointing to the image. The image must be accessible publicly.
Supported formats are: PNG, JPG and WEBP.

weight
float
Min: 0
Max: 1
Default: 1
Represents the strength or influence of this IP-Adapter in the generation process. A value of 0 means no influence, while 1 means maximum influence.

Response
Results will be delivered in the format below. It's possible to receive one or multiple images per message. This is due to the fact that images are generated in parallel, and generation time varies across nodes or the network.

{
  "data": [
    {
      "taskType": "imageInference",
      "taskUUID": "a770f077-f413-47de-9dac-be0b26a35da6",
      "imageUUID": "77da2d99-a6d3-44d9-b8c0-ae9fb06b6200",
      "imageURL": "https://im.runware.ai/image/ws/0.5/ii/a770f077-f413-47de-9dac-be0b26a35da6.jpg",
      "cost": 0.0013
    }
  ]
}
taskType
string
The API will return the taskType you sent in the request. In this case, it will be imageInference. This helps match the responses to the correct task type.

taskUUID
string
UUID v4
The API will return the taskUUID you sent in the request. This way you can match the responses to the correct request tasks.

imageUUID
string
UUID v4
The unique identifier of the image.

imageURL
string
If outputType is set to URL, this parameter contains the URL of the image to be downloaded.

imageBase64Data
string
If outputType is set to base64Data, this parameter contains the base64-encoded image data.

imageDataURI
string
If outputType is set to dataURI, this parameter contains the data URI of the image.

NSFWContent
boolean
If checkNSFW parameter is used, NSFWContent is included informing if the image has been flagged as potentially sensitive content.

true indicates the image has been flagged (is a sensitive image).
false indicates the image has not been flagged.
The filter occasionally returns false positives and very rarely false negatives.

cost
float
if includeCost is set to true, the response will include a cost field for each task object. This field indicates the cost of the request in USD.

On this page
Introduction
Request
taskType
taskUUID
outputType
outputFormat
outputQuality
uploadEndpoint
checkNSFW
includeCost
positivePrompt
negativePrompt
seedImage
maskImage
maskMargin
strength
outpainting
top
right
bottom
left
blur
height
width
model
vae
steps
scheduler
seed
CFGScale
clipSkip
promptWeighting
numberResults
refiner
model
startStep
startStepPercentage
embeddings
model
weight
controlNet
model
guideImage
weight
startStep
startStepPercentage
endStep
endStepPercentage
controlMode
lora
model
weight
ipAdapters
model
guideImage
weight
Response
taskType
taskUUID
imageUUID
imageURL
imageBase64Data
imageDataURI
NSFWContent
cost
Related docs
Schedulers
Discover the various schedulers available for image generation.
Models Overview
Explore the different models available. Choose the best model for your specific image generation needs.
Prompt Enhancer
Enhance your prompts with our Prompt Enhancer, optimizing your instructions for greater efficiency and effectiveness in your image generation tasks.